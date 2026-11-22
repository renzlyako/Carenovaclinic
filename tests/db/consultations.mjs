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
const files = ["0001_schema.sql","0002_rls_policies.sql","0003_audit_triggers.sql","0004_functions_views.sql","0006_appointments_doctor_guard.sql"];
await db.exec(files.map(f => read("migrations/"+f)).join("\n"));
const mk = async (email, role) => (await db.query("insert into auth.users(email,raw_app_meta_data) values ($1,$2::jsonb) returning id", [email, JSON.stringify({ role })])).rows[0].id;
const admin = await mk("a@x.com","admin"), rec = await mk("r@x.com","receptionist"), d1u = await mk("d1@x.com","doctor"), d2u = await mk("d2@x.com","doctor");
const d1 = (await db.query("insert into public.doctors(profile_id,specialization,license_no) values ($1,'GP','L1') returning id",[d1u])).rows[0].id;
const d2 = (await db.query("insert into public.doctors(profile_id,specialization,license_no) values ($1,'Peds','L2') returning id",[d2u])).rows[0].id;
const pat = (await db.query("insert into public.patients(first_name,last_name,birthdate,sex,contact_no) values ('Maria','Santos','1990-01-01','female','09171234567') returning id")).rows[0].id;
const med = (await db.query("insert into public.medicines(name,stock_qty,unit_price) values ('Paracetamol',100,2.5) returning id")).rows[0].id;
const ap = async (d,t)=> (await db.query("insert into public.appointments(patient_id,doctor_id,schedule) values ($1,$2,$3) returning id",[pat,d,t])).rows[0].id;
const a1 = await ap(d1,"2031-05-01T01:00:00Z"), a2 = await ap(d2,"2031-05-01T02:00:00Z");
const run = (uid, sql, p) => as(db, "authenticated", uid, (q) => q(sql, p));

let r = await run(d1u, "insert into public.consultations(appointment_id,diagnosis,notes) values ($1,'Flu','rest') returning id", [a1]);
ok("doctor creates consultation for own appointment", r.ok, r.err); const c1 = r.r?.[0]?.id;
r = await run(d1u, "insert into public.consultations(appointment_id,diagnosis) values ($1,'Flu')", [a1]);
ok("second consultation for same appointment -> 23505", !r.ok && r.code==="23505", r.code);
r = await run(d1u, "insert into public.consultations(appointment_id,diagnosis) values ($1,'X')", [a2]);
ok("doctor cannot create for another doctor's appointment (42501)", !r.ok && r.code==="42501", r.code);
r = await run(d1u, "insert into public.consultations(appointment_id,diagnosis) values ($1,'   ')", [await ap(d1,"2031-05-02T01:00:00Z")]);
ok("blank diagnosis rejected by CHECK 23514", !r.ok && r.code==="23514", r.code);
r = await run(rec, "insert into public.consultations(appointment_id,diagnosis) values ($1,'X')", [a2]);
ok("receptionist cannot create consultation", !r.ok && r.code==="42501", r.code);
r = await run(rec, "select id from public.consultations");
ok("receptionist sees 0 consultations (RLS)", r.ok && r.r.length===0);
r = await run(admin, "select id from public.consultations");
ok("admin can read consultations", r.ok && r.r.length===1);
r = await run(admin, "update public.consultations set diagnosis='Hacked' where id=$1 returning id",[c1]);
ok("admin cannot edit consultation (0 rows)", r.ok && r.r.length===0);
r = await run(d2u, "select id from public.consultations");
ok("other doctor sees 0 consultations", r.ok && r.r.length===0);
r = await run(d1u, "update public.consultations set diagnosis='Viral flu', notes=null where id=$1 returning id",[c1]);
ok("doctor updates own consultation", r.ok && r.r.length===1, r.err);
r = await run(d2u, "update public.consultations set diagnosis='x' where id=$1 returning id",[c1]);
ok("other doctor cannot update (0 rows)", r.ok && r.r.length===0);
// appointment embed visible + status change after consultation
r = await run(d1u, "update public.appointments set status='completed' where id=$1 and status='scheduled' returning id",[a1]);
ok("doctor completes appointment after consultation", r.ok && r.r.length===1, r.err);

// prescriptions
r = await run(d1u, "insert into public.prescriptions(consultation_id,medicine_id,dosage,qty) values ($1,$2,'1 tab q6h',10) returning id",[c1,med]);
ok("doctor adds prescription", r.ok, r.err); const rx = r.r?.[0]?.id;
r = await run(d1u, "insert into public.prescriptions(consultation_id,medicine_id,dosage,qty) values ($1,$2,'x',0)",[c1,med]);
ok("qty 0 rejected (23514)", !r.ok && r.code==="23514", r.code);
r = await run(d1u, "insert into public.prescriptions(consultation_id,medicine_id,dosage,qty) values ($1,'00000000-0000-0000-0000-000000000000','x',1)",[c1]);
ok("unknown medicine -> 23503", !r.ok && r.code==="23503", r.code);
r = await run(d2u, "insert into public.prescriptions(consultation_id,medicine_id,dosage,qty) values ($1,$2,'x',1)",[c1,med]);
ok("other doctor cannot prescribe on it (42501)", !r.ok && r.code==="42501", r.code);
r = await run(d1u, "insert into public.prescriptions(consultation_id,medicine_id,dosage,qty,dispensed_at) values ($1,$2,'x',1,now())",[c1,med]);
ok("doctor cannot set dispensed_at (column privilege 42501)", !r.ok && r.code==="42501", r.code);
r = await run(rec, "select id from public.prescriptions");
ok("receptionist can read prescriptions (for dispensing)", r.ok && r.r.length===1);
r = await run(d1u, "delete from public.consultations where id=$1 returning id",[c1]);
ok("consultation with prescriptions cannot be deleted (23001/23503)", !r.ok && (r.code==="23001"||r.code==="23503"), r.code);
r = await run(d1u, "delete from public.prescriptions where id=$1 returning id",[rx]);
ok("doctor removes pending prescription", r.ok && r.r.length===1, r.err);
// dispensed lock
r = await run(d1u, "insert into public.prescriptions(consultation_id,medicine_id,dosage,qty) values ($1,$2,'2 tabs',5) returning id",[c1,med]); const rx2=r.r[0].id;
await db.query("update public.prescriptions set dispensed_at=now() where id=$1",[rx2]);
r = await run(d1u, "delete from public.prescriptions where id=$1 returning id",[rx2]);
ok("dispensed prescription cannot be removed (message has 'dispensed' or 0 rows)", (!r.ok && /dispensed/i.test(r.err)) || (r.ok && r.r.length===0), r.err);
r = await run(d1u, "update public.prescriptions set qty=99 where id=$1 returning id",[rx2]);
ok("dispensed prescription cannot be edited", (!r.ok && /dispensed/i.test(r.err)) || (r.ok && r.r.length===0), r.err);
// audit
const au = (await db.query("select action, table_name from public.audit_logs where table_name in ('consultations','prescriptions')")).rows;
ok("audit trail recorded consultation + prescription changes", au.some(x=>x.table_name==='consultations'&&x.action==='INSERT') && au.some(x=>x.table_name==='prescriptions'&&x.action==='DELETE'));
console.log(pass,"pass",fail,"fail");
