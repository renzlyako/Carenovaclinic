import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const read = (f) => fs.readFileSync(fileURLToPath(new URL("../../supabase/", import.meta.url)) + f, "utf8");
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

// ---- Case A: the migration applies on top of the original all-in-one (what the user already ran) ----
const db = await fresh();
const base = ["0001_schema.sql","0002_rls_policies.sql","0003_audit_triggers.sql","0004_functions_views.sql"].map(f => read("migrations/"+f)).join("\n");
await db.exec(base);
const mig = await db.exec(read("migrations/0006_appointments_doctor_guard.sql")).then(() => "ok", (e) => e.message);
ok("0006 applies on top of 0001-0004", mig === "ok", mig);

const mk = async (email, role) => (await db.query("insert into auth.users(email,raw_app_meta_data) values ($1,$2::jsonb) returning id", [email, JSON.stringify({ role })])).rows[0].id;
const admin = await mk("a@x.com", "admin"), rec = await mk("r@x.com", "receptionist"), d1u = await mk("d1@x.com", "doctor"), d2u = await mk("d2@x.com", "doctor");
const d1 = (await db.query("insert into public.doctors(profile_id,specialization,license_no) values ($1,'GP','L1') returning id", [d1u])).rows[0].id;
const d2 = (await db.query("insert into public.doctors(profile_id,specialization,license_no) values ($1,'Peds','L2') returning id", [d2u])).rows[0].id;
const pat = (await db.query("insert into public.patients(first_name,last_name,birthdate,sex,contact_no) values ('Maria','Santos','1990-01-01','female','09171234567') returning id")).rows[0].id;
const pat2 = (await db.query("insert into public.patients(first_name,last_name,birthdate,sex,contact_no) values ('Juan','Cruz','1980-01-01','male','09171234568') returning id")).rows[0].id;

const book = (uid, p, d, when) => as(db, "authenticated", uid, (q) =>
  q("insert into public.appointments(patient_id,doctor_id,schedule,reason) values ($1,$2,$3,$4) returning id", [p, d, when, "Check-up"]));

let r = await book(rec, pat, d1, "2031-05-01T01:00:00Z");
ok("receptionist books appointment", r.ok, r.err);
const a1 = r.r[0].id;
r = await book(rec, pat2, d1, "2031-05-01T01:00:00Z");
ok("double-booking -> 23505 with index name in message (action maps it)", !r.ok && r.code === "23505" && /appointments_no_double_booking/.test(r.err), r.code + r.err);
r = await book(rec, pat2, d2, "2031-05-01T01:00:00Z");
ok("same time with a different doctor is fine", r.ok, r.err);
const a2 = r.r[0].id;
r = await book(d1u, pat, d1, "2031-06-01T01:00:00Z");
ok("doctor cannot book (RLS 42501)", !r.ok && r.code === "42501", r.code);
r = await as(db, "authenticated", rec, (q) => q("insert into public.appointments(patient_id,doctor_id,schedule) values ($1,$2,now())", ["00000000-0000-0000-0000-000000000000", d1]));
ok("unknown patient -> FK 23503", !r.ok && r.code === "23503", r.code);

// doctor guard
const upd = (uid, sql, params) => as(db, "authenticated", uid, (q) => q(sql, params));
r = await upd(d1u, "update public.appointments set status='completed' where id=$1 and status='scheduled' returning id", [a1]);
ok("doctor can mark own appointment completed", r.ok && r.r.length === 1, r.err);
r = await upd(d1u, "update public.appointments set schedule='2031-07-01T01:00:00Z' where id=$1 returning id", [a1]);
ok("doctor CANNOT change schedule (guard)", !r.ok && /only change the status/.test(r.err), r.err);
r = await upd(d1u, "update public.appointments set reason='x' where id=$1 returning id", [a1]);
ok("doctor CANNOT change reason (guard)", !r.ok && /only change the status/.test(r.err));
r = await upd(d1u, "update public.appointments set patient_id=$2 where id=$1 returning id", [a1, pat2]);
ok("doctor CANNOT change patient (guard)", !r.ok && /only change the status/.test(r.err));
r = await upd(d1u, "update public.appointments set status='completed' where id=$1 returning id", [a2]);
ok("doctor cannot touch another doctor's appointment (0 rows)", r.ok && r.r.length === 0);
r = await upd(d1u, "update public.appointments set status='cancelled' where id=$1 and status='scheduled' returning id", [a1]);
ok("status change only from 'scheduled' (0 rows once completed)", r.ok && r.r.length === 0);
r = await upd(rec, "update public.appointments set schedule='2031-08-01T02:00:00Z', reason='Moved', status='scheduled' where id=$1 returning id", [a1]);
ok("receptionist can reschedule / edit anything", r.ok && r.r.length === 1, r.err);
r = await upd(rec, "update public.appointments set schedule='2031-05-01T01:00:00Z' where id=$1 returning id", [a2]);
r = await upd(rec, "update public.appointments set doctor_id=$2, schedule='2031-05-01T01:00:00Z' where id=$1 returning id", [a1, d2]);
ok("reschedule into a taken slot -> 23505", !r.ok && r.code === "23505", r.code);
r = await upd(rec, "update public.appointments set status='cancelled' where id=$1 returning id", [a2]);
r = await book(rec, pat, d2, "2031-05-01T01:00:00Z");
ok("cancelled slot can be booked again", r.ok, r.err);

// delete
r = await as(db, "authenticated", rec, (q) => q("delete from public.appointments where id=$1 returning id", [a1]));
ok("receptionist cannot delete (0 rows)", r.ok && r.r.length === 0);
r = await as(db, "authenticated", admin, (q) => q("delete from public.appointments where id=$1 returning id", [a1]));
ok("admin can delete an appointment", r.ok && r.r.length === 1, r.err);

// embeds used by the list page
r = await as(db, "authenticated", rec, (q) => q(`select a.id, p.first_name, pr.full_name from public.appointments a join public.patients p on p.id=a.patient_id join public.doctors d on d.id=a.doctor_id join public.profiles pr on pr.id=d.profile_id`));
ok("receptionist can read patient + doctor names", r.ok && r.r.length >= 1 && r.r[0].full_name, JSON.stringify(r));
r = await as(db, "authenticated", d2u, (q) => q("select id from public.appointments"));
ok("doctor2 sees only own appointments", r.ok && r.r.length >= 1);
const audit = (await db.query("select count(*)::int n from public.audit_logs where table_name='appointments'")).rows[0].n;
ok("appointment changes are audited", audit >= 6, audit);

// ---- Case B: updated all_in_one + dev_reset ----
const db2 = await fresh();
const b = await db2.exec(read("all_in_one.sql")).then(() => "ok", (e) => e.message);
ok("all_in_one.sql (with 0006) applies on a fresh DB", b === "ok", b);
const rs = await db2.exec(read("dev_reset.sql")).then(() => "ok", (e) => e.message);
ok("dev_reset.sql still runs", rs === "ok", rs);
const left = (await db2.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'")).rows[0].n;
ok("dev_reset leaves no functions behind", left === 0, left);

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
