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
const files = ["0001_schema.sql","0002_rls_policies.sql","0003_audit_triggers.sql","0004_functions_views.sql","0006_appointments_doctor_guard.sql","0007_pending_prescriptions.sql"];
await db.exec(files.map(f => read("migrations/"+f)).join("\n"));
const mk = async (email, role) => (await db.query("insert into auth.users(email,raw_app_meta_data) values ($1,$2::jsonb) returning id", [email, JSON.stringify({ role })])).rows[0].id;
const admin = await mk("a@x.com","admin"), rec = await mk("r@x.com","receptionist"), d1u = await mk("d1@x.com","doctor"), d2u = await mk("d2@x.com","doctor");
const d1 = (await db.query("insert into public.doctors(profile_id,specialization,license_no) values ($1,'GP','L1') returning id",[d1u])).rows[0].id;
const d2 = (await db.query("insert into public.doctors(profile_id,specialization,license_no) values ($1,'Peds','L2') returning id",[d2u])).rows[0].id;
const P = async (n)=> (await db.query("insert into public.patients(first_name,last_name,birthdate,sex,contact_no) values ($1,'T','1990-01-01','male','09171234567') returning id",[n])).rows[0].id;
const [p1,p2,p3] = [await P("A"),await P("B"),await P("C")];
// appointments: 2 today for d1 (one cancelled), 1 today for d2, 1 two days ago for d1 (completed)
const A = async (pat,d,sql,status="scheduled")=> (await db.query(`insert into public.appointments(patient_id,doctor_id,schedule,status) values ($1,$2,${sql},$3) returning id`,[pat,d,status])).rows[0].id;
const todayNoon = "((now() at time zone 'Asia/Manila')::date + time '12:00') at time zone 'Asia/Manila'";
const todayEve  = "((now() at time zone 'Asia/Manila')::date + time '15:00') at time zone 'Asia/Manila'";
const a1 = await A(p1,d1,todayNoon);
const a2 = await A(p2,d1,todayEve,"cancelled");
const a3 = await A(p3,d2,todayNoon);
const a4 = await A(p1,d1,"now() - interval '2 days'","completed");
await db.query("insert into public.consultations(appointment_id,diagnosis) values ($1,'  Flu '),($2,'flu')",[a1,a4]);
await db.query("insert into public.medicines(name,stock_qty,reorder_level,unit_price) values ('Low',3,10,5),('Fine',100,10,5),('OffLow',1,10,5)");
await db.query("update public.medicines set is_active=false where name='OffLow'");
// invoices + payments
const inv1 = (await db.query("insert into public.invoices(patient_id,appointment_id) values ($1,$2) returning id",[p1,a1])).rows[0].id;
await db.query("insert into public.invoice_items(invoice_id,description,qty,unit_price) values ($1,'Fee',1,500)",[inv1]);
await db.query("insert into public.payments(invoice_id,amount,method) values ($1,200,'cash'),($1,100,'gcash')",[inv1]);
const inv2 = (await db.query("insert into public.invoices(patient_id,appointment_id) values ($1,$2) returning id",[p3,a3])).rows[0].id;
await db.query("insert into public.invoice_items(invoice_id,description,qty,unit_price) values ($1,'Fee',1,300)",[inv2]);
const run = (uid, sql, p) => as(db, "authenticated", uid, (q) => q(sql, p));

let r = await run(admin, "select * from public.v_dashboard_kpis");
const k = r.r?.[0];
ok("admin KPI: appointments today = 2 (cancelled excluded)", k?.appointments_today===2, JSON.stringify(k));
ok("admin KPI: total patients 3", k?.total_patients===3);
ok("admin KPI: revenue this month = 300", Number(k?.revenue_this_month)===300, k?.revenue_this_month);
ok("admin KPI: unpaid invoices = 2 (partial + unpaid)", k?.unpaid_invoices===2, k?.unpaid_invoices);
ok("admin KPI: low stock = 1 (inactive excluded)", k?.low_stock_medicines===1, k?.low_stock_medicines);

r = await run(d1u, "select * from public.v_dashboard_kpis");
ok("doctor KPI: only own appointments today = 1", r.r?.[0]?.appointments_today===1, JSON.stringify(r.r));
ok("doctor KPI: only own patients = 2 (patients with any appointment of theirs, same rule as the Patients page)", r.r?.[0]?.total_patients===2, JSON.stringify(r.r));
r = await run(rec, "select * from public.v_dashboard_kpis");
ok("receptionist KPI: appointments today = 2", r.r?.[0]?.appointments_today===2);

r = await run(admin, "select * from public.v_appointments_per_day");
ok("per-day view: today=2, 2 days ago=1", r.ok && r.r.reduce((s,x)=>s+x.total,0)===3 && r.r.length===2, JSON.stringify(r.r));
r = await run(admin, "select * from public.v_revenue_monthly");
ok("monthly revenue 300", r.ok && r.r.length===1 && Number(r.r[0].revenue)===300, JSON.stringify(r.r));
r = await run(admin, "select * from public.v_appointment_status_counts");
const st = Object.fromEntries(r.r.map(x=>[x.status,x.total]));
ok("status counts scheduled 2 / cancelled 1 / completed 1", st.scheduled===2 && st.cancelled===1 && st.completed===1, JSON.stringify(st));
r = await run(admin, "select * from public.v_top_diagnoses");
ok("diagnoses normalised: 'flu' x2", r.r.length===1 && r.r[0].diagnosis==="flu" && r.r[0].total===2, JSON.stringify(r.r));
r = await run(rec, "select * from public.v_top_diagnoses");
ok("receptionist sees no diagnoses via view (RLS)", r.ok && r.r.length===0);
r = await run(admin, "select * from public.v_low_stock_medicines");
ok("low stock view lists only active low item", r.r.length===1 && r.r[0].name==="Low", JSON.stringify(r.r));
r = await run(admin, "select method, payments, total from public.v_daily_collection order by method");
ok("daily collection by method", r.r.length===2 && Number(r.r.find(x=>x.method==="cash").total)===200 && Number(r.r.find(x=>x.method==="gcash").total)===100, JSON.stringify(r.r));
r = await run(admin, "select doctor_name, patients, appointments from public.v_patients_per_doctor order by doctor_name");
ok("patients per doctor view returns both doctors", r.ok && r.r.length===2, JSON.stringify(r.r));
const dd = r.r;
r = await run(admin, "select d.id from public.doctors d");
r = await run(admin, "select patients, appointments from public.v_patients_per_doctor where appointments=2");
ok("d1: 1 distinct patient, 2 appointments (cancelled excluded)", r.r.length===1 && r.r[0].patients===1, JSON.stringify(r.r));
r = await as(db,"anon",null,(q)=>q("select * from public.v_dashboard_kpis"));
ok("anon cannot read views", !r.ok && r.code==="42501", r.code);
r = await run(rec, "select invoice_no from public.invoices where status in ('unpaid','partial') and total > 0");
ok("outstanding report query works for receptionist", r.ok && r.r.length===2);
console.log(pass,"pass",fail,"fail");
