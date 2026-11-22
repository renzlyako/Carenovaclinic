import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const read = (f) => fs.readFileSync(new URL("../../supabase/", import.meta.url).pathname + f, "utf8");
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { if (c) { pass++; console.log("  PASS", n); } else { fail++; console.log("  FAIL", n, x); } };

async function fresh() {
  const db = new PGlite();
  await db.exec(`
   create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
   create schema auth;
   create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}', last_sign_in_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
   grant usage on schema auth to anon, authenticated, service_role;
   grant execute on function auth.uid() to anon, authenticated, service_role;`);
  return db;
}
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


const db = await fresh();
const a = await db.exec(read("all_in_one.sql")).then(() => "ok", (e) => e.message);
ok("all_in_one.sql (0001-0008) applies on a fresh DB", a === "ok", a);
const mk = async (email, role) => (await db.query("insert into auth.users(email,raw_app_meta_data) values ($1,$2::jsonb) returning id", [email, JSON.stringify(role ? { role } : {})])).rows[0].id;
const admin = await mk("a@x.com", "admin"), rec = await mk("r@x.com", "receptionist"), d1u = await mk("d1@x.com", "doctor"), nobody = await mk("n@x.com", null);
const d1 = (await db.query("insert into public.doctors(profile_id,specialization,license_no) values ($1,'GP','L1') returning id", [d1u])).rows[0].id;
const run = (role, uid, sql, p) => as(db, role, uid, (q) => q(sql, p));

// ---- SQL injection: payloads are data, never SQL ----
const payloads = ["Robert'); DROP TABLE patients;--", "' OR '1'='1", "'; UPDATE profiles SET role='admin' WHERE true;--", "\" OR 1=1 --"];
let n = 0;
for (const p of payloads) {
  const r = await run("authenticated", rec, "insert into public.patients(first_name,last_name,birthdate,sex,contact_no) values ($1,'Test','1990-01-01','male','09171234567') returning first_name", [p]);
  if (r.ok && r.r[0].first_name === p) n++;
}
ok("SQL-injection payloads are stored as plain text (parameterized)", n === payloads.length, n);
ok("patients table still exists with all rows", (await db.query("select count(*)::int c from public.patients")).rows[0].c === payloads.length);
ok("no profile was escalated to admin by a payload", (await db.query("select count(*)::int c from public.profiles where role='admin'")).rows[0].c === 1);
const s = await run("authenticated", rec, "select count(*)::int c from public.patients where last_name ilike $1", ["%' OR '1'='1"]);
ok("injection in a search term matches nothing", s.ok && s.r[0].c === 0);

// ---- Dynamic SQL is not reachable from the client: functions take typed parameters ----
let r = await run("authenticated", admin, "select public.dispense_prescription($1::uuid,$2::uuid)", ["'; drop table patients;--", rec]);
ok("typed RPC parameter rejects an injection string (invalid uuid, 22P02)", !r.ok && r.code === "22P02", r.code);

// ---- RBAC matrix: what each identity can read ----
const tables = ["patients", "appointments", "consultations", "prescriptions", "medicines", "invoices", "invoice_items", "payments", "profiles", "doctors", "audit_logs"];
const seeded = await db.query("insert into public.medicines(name,stock_qty,unit_price) values ('Paracetamol',50,2.5) returning id");
for (const [who, role, uid, expectAuditBlocked] of [["anon", "anon", null, true], ["inactive user", "authenticated", nobody, true], ["receptionist", "authenticated", rec, true], ["doctor", "authenticated", d1u, true]]) {
  const res = await run(role, uid, "select count(*)::int c from public.audit_logs");
  ok(`${who}: cannot read audit_logs`, !res.ok ? res.code === "42501" : res.r[0].c === 0, res.code);
}
r = await run("authenticated", admin, "select count(*)::int c from public.audit_logs");
ok("admin: can read audit_logs", r.ok && r.r[0].c > 0);
r = await run("anon", null, "select count(*)::int c from public.medicines");
ok("anon: cannot read medicines", !r.ok ? r.code === "42501" : r.r[0].c === 0);
r = await run("authenticated", nobody, "select count(*)::int c from public.medicines");
ok("inactive user: sees no medicines", r.ok ? r.r[0].c === 0 : true);
r = await run("authenticated", rec, "select count(*)::int c from public.medicines");
ok("receptionist: can read medicines", r.ok && r.r[0].c === 1);
r = await run("authenticated", d1u, "insert into public.medicines(name,stock_qty,unit_price) values ('X',1,1)");
ok("doctor: cannot create medicines", !r.ok);
r = await run("authenticated", rec, "insert into public.medicines(name,stock_qty,unit_price) values ('X',1,1)");
ok("receptionist: cannot create medicines", !r.ok);
r = await run("authenticated", admin, "insert into public.medicines(name,stock_qty,unit_price) values ('Y',1,1)");
ok("admin: can create medicines", r.ok, r.err);

// ---- Privileged functions and privilege escalation ----
for (const [who, uid] of [["admin", admin], ["receptionist", rec], ["doctor", d1u]]) {
  r = await run("authenticated", uid, "select public.restore_from_backup('{}'::jsonb)");
  ok(`${who} (authenticated) cannot call restore_from_backup`, !r.ok && r.code === "42501", r.code);
}
r = await run("anon", null, "select public.restore_from_backup('{}'::jsonb)");
ok("anon cannot call restore_from_backup", !r.ok && r.code === "42501", r.code);
r = await run("authenticated", rec, "update public.profiles set role='admin' where id=$1", [rec]);
const roleNow = (await db.query("select role from public.profiles where id=$1", [rec])).rows[0].role;
ok("receptionist cannot promote self to admin", roleNow === "receptionist", roleNow);
r = await run("authenticated", d1u, "update public.profiles set is_active=false where id=$1", [admin]);
ok("doctor cannot deactivate the admin", (await db.query("select is_active from public.profiles where id=$1", [admin])).rows[0].is_active === true);

// ---- Audit trail cannot be tampered with ----
r = await run("authenticated", admin, "delete from public.audit_logs");
ok("admin cannot delete audit logs", !r.ok || (await db.query("select count(*)::int c from public.audit_logs")).rows[0].c > 0);
r = await run("authenticated", admin, "update public.audit_logs set action='X'");
ok("admin cannot edit audit logs", (await db.query("select count(*)::int c from public.audit_logs where action='X'")).rows[0].c === 0);

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
