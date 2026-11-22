import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const read = (f) => fs.readFileSync(new URL("../../supabase/", import.meta.url).pathname + f, "utf8");
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { if (c) { pass++; console.log("  PASS", n); } else { fail++; console.log("  FAIL", n, x); } };

const db = new PGlite();
await db.exec(`
 create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
 create schema auth;
 create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}', last_sign_in_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
 grant usage on schema auth to anon, authenticated, service_role;
 grant execute on function auth.uid() to anon, authenticated, service_role;`);
await db.exec(read("all_in_one.sql"));

async function as(db, role, uid, fn) {
  await db.exec("begin");
  try {
    await db.exec(`set local role ${role}`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? ""]);
    const r = await fn((s, p) => db.query(s, p).then((x) => x.rows));
    await db.exec("commit");
    return { ok: true, r };
  } catch (e) { await db.exec("rollback"); return { ok: false, code: e.code, err: String(e.message) }; }
}
const mk = async (email, role) => (await db.query("insert into auth.users(email,raw_app_meta_data) values ($1,$2::jsonb) returning id", [email, JSON.stringify({ role })])).rows[0].id;
const admin = await mk("a@x.com", "admin"), rec = await mk("r@x.com", "receptionist"), du = await mk("d@x.com", "doctor");
const doc = (await db.query("insert into public.doctors(profile_id,specialization,license_no) values ($1,'GP','L1') returning id", [du])).rows[0].id;

const ins = (uid, first, last) => as(db, "authenticated", uid, (q) => q(
  `insert into public.patients(first_name,last_name,birthdate,sex,contact_no,address,emergency_contact_name,emergency_contact_no)
   values ($1,$2,'1990-03-14','female','09171234567',null,null,null) returning id`, [first, last]));

let r = await ins(rec, "Maria", "Santos"); ok("receptionist creates patient (insert...returning id)", r.ok && r.r[0].id, r.err);
const p1 = r.r[0].id;
r = await ins(rec, "Juan", "Dela Cruz"); const p2 = r.r[0].id;
r = await ins(du, "No", "Way"); ok("doctor insert blocked by RLS (error 42501)", !r.ok && r.code === "42501", r.code + r.err);

// update semantics
r = await as(db, "authenticated", rec, (q) => q("update public.patients set contact_no='09999999999' where id=$1 returning id", [p1]));
ok("receptionist update returns 1 row", r.ok && r.r.length === 1);
r = await as(db, "authenticated", du, (q) => q("update public.patients set contact_no='09999999999' where id=$1 returning id", [p1]));
ok("doctor update -> 0 rows, no error (action shows 'no permission')", r.ok && r.r.length === 0, JSON.stringify(r));
r = await as(db, "authenticated", rec, (q) => q("update public.patients set contact_no='abc' where id=$1 returning id", [p1]));
ok("bad phone stopped by DB CHECK (23514) even if zod is bypassed", !r.ok && r.code === "23514", r.code);

// search tokens (same logic as listPatients)
const search = (term) => {
  const tokens = term.split(/\s+/).filter(Boolean);
  const where = tokens.map((_, i) => `(first_name ilike $${i + 1} or last_name ilike $${i + 1} or patient_no ilike $${i + 1})`).join(" and ");
  return as(db, "authenticated", rec, (q) => q(`select first_name from public.patients where ${where || "true"}`, tokens.map((t) => `%${t}%`)));
};
r = await search("maria santos"); ok("full-name search 'maria santos' finds 1", r.ok && r.r.length === 1 && r.r[0].first_name === "Maria", JSON.stringify(r));
r = await search("dela"); ok("partial last name search", r.ok && r.r.length === 1);
r = await search("P-0000"); ok("patient number search", r.ok && r.r.length === 2, JSON.stringify(r));
r = await search("zzz"); ok("no match returns 0", r.ok && r.r.length === 0);

// delete semantics
await db.query("insert into public.appointments(patient_id,doctor_id,schedule) values ($1,$2,'2031-01-01T09:00:00Z')", [p1, doc]);
r = await as(db, "authenticated", rec, (q) => q("delete from public.patients where id=$1 returning id", [p2]));
ok("receptionist delete -> 0 rows (admin only)", r.ok && r.r.length === 0);
r = await as(db, "authenticated", admin, (q) => q("delete from public.patients where id=$1 returning id", [p1]));
ok("admin cannot delete patient with appointments (RESTRICT 23001)", !r.ok && r.code === "23001", r.code + r.err);
r = await as(db, "authenticated", admin, (q) => q("delete from public.patients where id=$1 returning id", [p2]));
ok("admin deletes patient without records", r.ok && r.r.length === 1, r.err);

// doctor sees only own patients
r = await as(db, "authenticated", du, (q) => q("select id from public.patients"));
ok("doctor sees only patient with own appointment", r.ok && r.r.length === 1 && r.r[0].id === p1, JSON.stringify(r));

// audit
const a = (await db.query("select action, table_name, user_email from public.audit_logs where table_name='patients' order by id")).rows;
ok("audit has INSERT, UPDATE and DELETE for patients", ["INSERT", "UPDATE", "DELETE"].every((x) => a.some((l) => l.action === x)), JSON.stringify(a.map(l=>l.action)));
ok("audit records who did it (email)", a.some((l) => l.action === "DELETE" && l.user_email === "a@x.com"));

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
