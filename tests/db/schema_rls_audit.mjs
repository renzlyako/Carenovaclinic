import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";

const BASE = fileURLToPath(new URL("../../supabase/", import.meta.url));
const read = (f) => fs.readFileSync(BASE + f, "utf8");

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra); }
};

// Mock ng Supabase environment (roles + auth schema)
async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_app_meta_data jsonb not null default '{}'::jsonb,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      last_sign_in_at timestamptz
    );
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  await db.exec(read("all_in_one.sql"));
  return db;
}

// Patakbuhin bilang isang role/user (parang request sa Supabase)
async function as(db, role, uid, fn) {
  await db.exec("begin");
  try {
    await db.exec(`set local role ${role}`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? ""]);
    const q = async (s, p) => (await db.query(s, p)).rows;
    const r = await fn(q);
    await db.exec("commit");
    return { ok: true, r };
  } catch (e) {
    await db.exec("rollback");
    return { ok: false, err: String(e.message) };
  }
}

const mkUser = async (db, email, appRole, name) => {
  const meta = appRole ? { role: appRole } : {};
  const { rows } = await db.query(
    `insert into auth.users (email, raw_app_meta_data, raw_user_meta_data)
     values ($1, $2::jsonb, $3::jsonb) returning id`,
    [email, JSON.stringify(meta), JSON.stringify({ full_name: name })]
  );
  return rows[0].id;
};

(async () => {
  console.log("== Loading schema ==");
  const db = await setup();
  console.log("  schema loaded OK");

  // ---------- users ----------
  const admin = await mkUser(db, "admin@x.com", "admin", "Admin A");
  const doc1u = await mkUser(db, "d1@x.com", "doctor", "Dr One");
  const doc2u = await mkUser(db, "d2@x.com", "doctor", "Dr Two");
  const recep = await mkUser(db, "r@x.com", "receptionist", "Rita");
  const stray = await mkUser(db, "stray@x.com", null, "Self Signup");

  console.log("== Auth integration ==");
  const prof = (await db.query("select id, role, is_active from public.profiles")).rows;
  ok("profiles auto-created for all 5 users", prof.length === 5);
  ok("self-signup (no app role) is INACTIVE", prof.find((p) => p.id === stray).is_active === false);
  ok("admin-assigned role is active", prof.find((p) => p.id === admin).is_active === true);

  const d1 = (await db.query("insert into public.doctors(profile_id,specialization,license_no) values ($1,'GP','L1') returning id", [doc1u])).rows[0].id;
  const d2 = (await db.query("insert into public.doctors(profile_id,specialization,license_no) values ($1,'Peds','L2') returning id", [doc2u])).rows[0].id;
  let r = await db.query("insert into public.doctors(profile_id,specialization,license_no) values ($1,'X','L3')", [recep]).then(() => null, (e) => e.message);
  ok("doctor row requires profile.role = doctor", r && /role = doctor/.test(r), r);

  console.log("== RBAC / RLS ==");
  r = await as(db, "anon", null, (q) => q("select * from public.patients"));
  ok("anon cannot read patients", !r.ok && /permission denied/.test(r.err), r.err);

  r = await as(db, "authenticated", stray, (q) => q("select * from public.patients"));
  ok("inactive user sees 0 patients", r.ok && r.r.length === 0);

  const pat = async (uid, first) =>
    as(db, "authenticated", uid, (q) =>
      q(`insert into public.patients(first_name,last_name,birthdate,sex,contact_no) values ($1,'Tester','1990-01-01','male','09171234567') returning id, patient_no`, [first]));
  r = await pat(doc1u, "Nope");
  ok("doctor cannot create patient", !r.ok && /row-level security/.test(r.err), r.err);
  r = await pat(recep, "PatA");
  ok("receptionist can create patient", r.ok);
  const pA = r.r[0].id;
  ok("patient_no auto-generated (P-#####)", /^P-\d{5}$/.test(r.r[0].patient_no), r.r[0].patient_no);
  r = await pat(recep, "PatB");
  const pB = r.r[0].id;

  r = await as(db, "authenticated", recep, (q) =>
    q(`insert into public.patients(first_name,last_name,birthdate,sex,contact_no) values ('Bad','Phone','1990-01-01','male','abc')`));
  ok("CHECK: invalid contact_no rejected", !r.ok && /check constraint/.test(r.err), r.err);
  r = await as(db, "authenticated", recep, (q) =>
    q(`insert into public.patients(first_name,last_name,birthdate,sex,contact_no) values ('Fut','Ure','2999-01-01','male','09171234567')`));
  ok("CHECK: future birthdate rejected", !r.ok && /check constraint/.test(r.err), r.err);

  const appt = (uid, p, d, when) =>
    as(db, "authenticated", uid, (q) =>
      q(`insert into public.appointments(patient_id,doctor_id,schedule,reason) values ($1,$2,$3,'x') returning id`, [p, d, when]));
  r = await appt(recep, pA, d1, "2030-01-01T09:00:00Z");
  ok("receptionist can book appointment", r.ok, r.err);
  const aA = r.r[0].id;
  r = await appt(recep, pB, d2, "2030-01-01T09:00:00Z");
  const aB = r.r[0].id;

  r = await appt(recep, pB, d1, "2030-01-01T09:00:00Z");
  ok("double-booking same doctor+time rejected", !r.ok && /duplicate key|unique/.test(r.err), r.err);
  r = await as(db, "authenticated", recep, (q) => q(`update public.appointments set status='cancelled' where id=$1`, [aA]));
  r = await appt(recep, pB, d1, "2030-01-01T09:00:00Z");
  ok("slot can be rebooked after cancellation", r.ok, r.err);
  await db.query("update public.appointments set status='scheduled' where id=$1", [aA]).catch(() => {});
  // ibalik sa tamang estado: i-cancel ang bagong booking para hindi mag-conflict
  await db.query("delete from public.appointments where patient_id=$1 and doctor_id=$2", [pB, d1]);

  r = await as(db, "authenticated", doc1u, (q) => q("select id from public.appointments"));
  ok("doctor1 sees only own appointments", r.ok && r.r.length === 1 && r.r[0].id === aA, JSON.stringify(r));
  r = await as(db, "authenticated", doc1u, (q) => q("select id from public.patients"));
  ok("doctor1 sees only own patients", r.ok && r.r.length === 1 && r.r[0].id === pA);
  r = await as(db, "authenticated", doc2u, (q) => q("select id from public.patients"));
  ok("doctor2 sees only own patients", r.ok && r.r.length === 1 && r.r[0].id === pB);
  r = await as(db, "authenticated", recep, (q) => q("select id from public.patients"));
  ok("receptionist sees all patients", r.ok && r.r.length === 2);

  r = await as(db, "authenticated", recep, (q) => q("update public.profiles set role='admin' where id=$1 returning id", [recep]));
  const still = (await db.query("select role from public.profiles where id=$1", [recep])).rows[0].role;
  ok("receptionist cannot self-promote to admin", still === "receptionist", JSON.stringify(r));
  r = await as(db, "authenticated", admin, (q) => q("update public.profiles set full_name='Rita C.' where id=$1 returning id", [recep]));
  ok("admin can update profiles", r.ok && r.r.length === 1, r.err);

  console.log("== Consultations / prescriptions ==");
  const cons = (uid, a) => as(db, "authenticated", uid, (q) =>
    q("insert into public.consultations(appointment_id,diagnosis) values ($1,'Flu') returning id", [a]));
  r = await cons(doc1u, aB);
  ok("doctor1 cannot add consultation to doctor2's appointment", !r.ok && /row-level security/.test(r.err), r.err);
  r = await cons(recep, aA);
  ok("receptionist cannot add consultations", !r.ok && /row-level security/.test(r.err), r.err);
  r = await cons(doc1u, aA);
  ok("doctor1 can add consultation to own appointment", r.ok, r.err);
  const cA = r.r[0].id;
  r = await cons(doc2u, aB);
  r = await as(db, "authenticated", doc2u, (q) => q("select id from public.consultations"));
  ok("doctor2 cannot see doctor1's consultations", r.ok && r.r.length === 1);
  r = await as(db, "authenticated", recep, (q) => q("select id from public.consultations"));
  ok("receptionist sees 0 consultations", r.ok && r.r.length === 0);
  r = await as(db, "authenticated", admin, (q) => q("select id from public.consultations"));
  ok("admin can read consultations", r.ok && r.r.length === 2);

  const medPara = (await db.query("insert into public.medicines(name,stock_qty,reorder_level,unit_price) values ('Paracetamol',100,10,2.50) returning id")).rows[0].id;
  const medLow = (await db.query("insert into public.medicines(name,stock_qty,reorder_level,unit_price) values ('Amlodipine',3,10,9.00) returning id")).rows[0].id;
  r = await as(db, "authenticated", recep, (q) => q("insert into public.medicines(name,stock_qty,unit_price) values ('Hack',1,1)"));
  ok("receptionist cannot add medicines", !r.ok && /row-level security/.test(r.err), r.err);

  const rx = (med, qty) => as(db, "authenticated", doc1u, (q) =>
    q("insert into public.prescriptions(consultation_id,medicine_id,dosage,qty) values ($1,$2,'1 tab/6h',$3) returning id", [cA, med, qty]));
  r = await rx(medPara, 5);
  ok("doctor can prescribe", r.ok, r.err);
  const rx1 = r.r[0].id;
  r = await rx(medLow, 5);
  const rx2 = r.r[0].id;
  r = await as(db, "authenticated", doc1u, (q) => q("update public.prescriptions set dispensed_at=now() where id=$1", [rx1]));
  ok("doctor cannot fake dispensed_at (column privilege)", !r.ok && /permission denied/.test(r.err), r.err);

  console.log("== Billing + transaction (dispense) ==");
  r = await as(db, "authenticated", recep, (q) =>
    q("insert into public.invoices(patient_id,appointment_id,total) values ($1,$2,999) returning id", [pA, aA]));
  ok("client cannot set invoice total (column privilege)", !r.ok && /permission denied/.test(r.err), r.err);
  r = await as(db, "authenticated", recep, (q) =>
    q("insert into public.invoices(patient_id,appointment_id) values ($1,$2) returning id, invoice_no", [pA, aA]));
  ok("receptionist can create invoice", r.ok, r.err);
  const inv = r.r[0].id;
  ok("invoice_no auto-generated", r.r[0].invoice_no === "INV-000001", r.r[0].invoice_no);

  r = await as(db, "authenticated", doc1u, (q) => q("select public.dispense_prescription($1,$2)", [rx1, inv]));
  ok("doctor cannot dispense", !r.ok && /Not authorized/.test(r.err), r.err);

  r = await as(db, "authenticated", recep, (q) => q("select public.dispense_prescription($1,$2) as item", [rx1, inv]));
  ok("dispense succeeds", r.ok, r.err);
  let st = (await db.query("select stock_qty from public.medicines where id=$1", [medPara])).rows[0].stock_qty;
  ok("stock reduced 100 -> 95", st === 95, st);
  let iv = (await db.query("select total,status from public.invoices where id=$1", [inv])).rows[0];
  ok("invoice total auto = 5 x 2.50 = 12.50", Number(iv.total) === 12.5 && iv.status === "unpaid", JSON.stringify(iv));
  r = await as(db, "authenticated", recep, (q) => q("select public.dispense_prescription($1,$2)", [rx1, inv]));
  ok("cannot dispense twice", !r.ok && /already dispensed/.test(r.err), r.err);
  r = await as(db, "authenticated", doc1u, (q) => q("delete from public.prescriptions where id=$1 returning id", [rx1]));
  ok("dispensed prescription cannot be deleted by doctor", r.ok && r.r.length === 0, JSON.stringify(r));

  // ROLLBACK demo: kulang ang stock
  const before = (await db.query("select stock_qty from public.medicines where id=$1", [medLow])).rows[0].stock_qty;
  r = await as(db, "authenticated", recep, (q) => q("select public.dispense_prescription($1,$2)", [rx2, inv]));
  ok("insufficient stock raises error", !r.ok && /Insufficient stock/.test(r.err), r.err);
  const after = (await db.query("select stock_qty from public.medicines where id=$1", [medLow])).rows[0].stock_qty;
  const rxState = (await db.query("select dispensed_at from public.prescriptions where id=$1", [rx2])).rows[0].dispensed_at;
  iv = (await db.query("select total from public.invoices where id=$1", [inv])).rows[0];
  ok("ROLLBACK: stock unchanged", before === after, `${before} vs ${after}`);
  ok("ROLLBACK: prescription still not dispensed", rxState === null);
  ok("ROLLBACK: invoice total unchanged (12.50)", Number(iv.total) === 12.5);

  // manual item + payments
  r = await as(db, "authenticated", recep, (q) =>
    q("insert into public.invoice_items(invoice_id,description,qty,unit_price) values ($1,'Consultation fee',1,500)", [inv]));
  ok("manual invoice item added", r.ok, r.err);
  iv = (await db.query("select total from public.invoices where id=$1", [inv])).rows[0];
  ok("invoice total recalculated = 512.50", Number(iv.total) === 512.5, JSON.stringify(iv));

  const pay = (amt) => as(db, "authenticated", recep, (q) =>
    q("insert into public.payments(invoice_id,amount,method) values ($1,$2,'cash') returning id", [inv, amt]));
  r = await pay(600);
  ok("overpayment rejected", !r.ok && /exceeds the remaining balance/.test(r.err), r.err);
  r = await pay(0);
  ok("zero payment rejected (CHECK)", !r.ok && /check constraint/.test(r.err), r.err);
  r = await pay(200);
  iv = (await db.query("select amount_paid,status from public.invoices where id=$1", [inv])).rows[0];
  ok("partial payment -> status 'partial'", r.ok && iv.status === "partial" && Number(iv.amount_paid) === 200, JSON.stringify(iv));
  r = await pay(312.5);
  iv = (await db.query("select amount_paid,status from public.invoices where id=$1", [inv])).rows[0];
  ok("full payment -> status 'paid'", r.ok && iv.status === "paid", JSON.stringify(iv));
  r = await pay(1);
  ok("cannot pay an already-paid invoice", !r.ok && /already fully paid/.test(r.err), r.err);
  r = await as(db, "authenticated", recep, (q) =>
    q("insert into public.invoice_items(invoice_id,description,qty,unit_price) values ($1,'late',1,1)", [inv]));
  ok("cannot add items to a paid invoice", !r.ok && /Cannot modify items/.test(r.err), r.err);
  r = await db.query("delete from public.payments").then(() => null, (e) => e.message);
  ok("payments are immutable (even for superuser)", r && /permanent records/.test(r), r);
  r = await as(db, "authenticated", recep, (q) => q("update public.invoices set total=1 where id=$1", [inv]));
  ok("receptionist cannot update invoice total", !r.ok && /permission denied/.test(r.err), r.err);
  r = await as(db, "authenticated", doc1u, (q) => q("select id from public.invoices"));
  ok("doctor can read invoice of own appointment", r.ok && r.r.length === 1);
  r = await as(db, "authenticated", doc2u, (q) => q("select id from public.invoices"));
  ok("doctor2 cannot read doctor1's invoice", r.ok && r.r.length === 0);
  r = await as(db, "authenticated", recep, (q) => q("select public.void_invoice($1)", [inv]));
  ok("receptionist cannot void invoice", !r.ok && /Only an admin/.test(r.err), r.err);
  r = await as(db, "authenticated", admin, (q) => q("select public.void_invoice($1)", [inv]));
  ok("cannot void invoice that has payments", !r.ok && /already has payments/.test(r.err), r.err);
  const inv2 = (await db.query("insert into public.invoices(patient_id) values ($1) returning id", [pB])).rows[0].id;
  r = await as(db, "authenticated", admin, (q) => q("select public.void_invoice($1)", [inv2]));
  ok("admin can void an unpaid invoice", r.ok, r.err);

  console.log("== Audit trail ==");
  const logs = (await db.query("select table_name, action, user_id, user_email, record_id from public.audit_logs")).rows;
  ok("audit_logs populated", logs.length > 20, logs.length);
  ok("patient INSERT logged with user + email",
    logs.some((l) => l.table_name === "patients" && l.action === "INSERT" && l.user_id === recep && l.user_email === "r@x.com"));
  ok("UPDATE logged", logs.some((l) => l.table_name === "profiles" && l.action === "UPDATE" && l.user_id === admin));
  ok("payment INSERT logged", logs.some((l) => l.table_name === "payments" && l.action === "INSERT"));
  const upd = (await db.query("select old_data, new_data from public.audit_logs where table_name='medicines' and action='UPDATE' limit 1")).rows[0];
  ok("UPDATE log has old_data and new_data (stock change)", upd && upd.old_data.stock_qty === 100 && upd.new_data.stock_qty === 95, JSON.stringify(upd));

  r = await as(db, "authenticated", admin, (q) => q("select count(*)::int as n from public.audit_logs"));
  ok("admin can read audit logs", r.ok && r.r[0].n > 20);
  r = await as(db, "authenticated", recep, (q) => q("select count(*)::int as n from public.audit_logs"));
  ok("receptionist sees 0 audit logs (RLS)", r.ok && r.r[0].n === 0);
  r = await as(db, "authenticated", doc1u, (q) => q("select count(*)::int as n from public.audit_logs"));
  ok("doctor sees 0 audit logs (RLS)", r.ok && r.r[0].n === 0);
  r = await as(db, "authenticated", admin, (q) => q("insert into public.audit_logs(action) values ('FAKE')"));
  ok("admin CANNOT insert fake audit rows", !r.ok && /permission denied/.test(r.err), r.err);
  r = await as(db, "authenticated", admin, (q) => q("update public.audit_logs set action='X'"));
  ok("admin CANNOT update audit logs", !r.ok && /permission denied/.test(r.err), r.err);
  r = await as(db, "authenticated", admin, (q) => q("delete from public.audit_logs"));
  ok("admin CANNOT delete audit logs", !r.ok && /permission denied/.test(r.err), r.err);
  r = await as(db, "service_role", null, (q) => q("delete from public.audit_logs"));
  ok("service_role CANNOT delete audit logs", !r.ok && /permission denied/.test(r.err), r.err);
  r = await as(db, "service_role", null, (q) => q("insert into public.audit_logs(action,details) values ('LOGIN','{}') returning id"));
  ok("service_role CAN append audit events (login etc.)", r.ok, r.err);
  r = await db.query("update public.audit_logs set action='X'").then(() => null, (e) => e.message);
  ok("TRIGGER blocks UPDATE even for superuser", r && /append-only/.test(r), r);
  r = await db.query("delete from public.audit_logs").then(() => null, (e) => e.message);
  ok("TRIGGER blocks DELETE even for superuser", r && /append-only/.test(r), r);
  r = await db.query("truncate public.audit_logs").then(() => null, (e) => e.message);
  ok("TRIGGER blocks TRUNCATE even for superuser", r && /append-only/.test(r), r);

  console.log("== Integrity ==");
  r = await db.query("update public.profiles set is_active=false where id=$1", [admin]).then(() => null, (e) => e.message);
  ok("cannot deactivate the last active admin", r && /last active admin/.test(r), r);
  r = await db.query("delete from auth.users where id=$1", [admin]).then(() => null, (e) => e.message);
  ok("cannot delete the last admin's account", r && /last active admin/.test(r), r);
  const admin2 = await mkUser(db, "admin2@x.com", "admin", "Admin 2");
  r = await db.query("update public.profiles set is_active=false where id=$1", [admin]).then(() => "ok", (e) => e.message);
  ok("can deactivate an admin when another exists", r === "ok", r);
  await db.query("update public.profiles set is_active=true where id=$1", [admin]);

  console.log("== Views ==");
  r = await as(db, "authenticated", admin, (q) => q("select * from public.v_dashboard_kpis"));
  ok("admin KPI view works", r.ok && r.r[0].total_patients === 2 && Number(r.r[0].revenue_this_month) === 512.5, JSON.stringify(r));
  ok("low_stock_medicines KPI counts Amlodipine", r.ok && r.r[0].low_stock_medicines === 1);
  r = await as(db, "authenticated", doc1u, (q) => q("select * from public.v_dashboard_kpis"));
  ok("doctor KPI view limited by RLS (1 patient)", r.ok && r.r[0].total_patients === 1, JSON.stringify(r));
  for (const v of ["v_appointments_per_day", "v_revenue_monthly", "v_appointment_status_counts", "v_top_diagnoses", "v_low_stock_medicines", "v_daily_collection", "v_patients_per_doctor"]) {
    r = await as(db, "authenticated", admin, (q) => q(`select * from public.${v}`));
    ok(`view ${v} queryable`, r.ok, r.err);
  }
  r = await as(db, "anon", null, (q) => q("select * from public.v_dashboard_kpis"));
  ok("anon cannot read views", !r.ok && /permission denied/.test(r.err), r.err);

  console.log("== Seed ==");
  const db2 = await setup();
  const au = await mkUser(db2, "a@x.com", "admin", "A");
  const du = await mkUser(db2, "d@x.com", "doctor", "Dr Seed");
  await db2.query("insert into public.doctors(profile_id,specialization,license_no) values ($1,'GP','S1')", [du]);
  const seedRes = await db2.exec(read("seed.sql")).then(() => "ok", (e) => e.message);
  ok("seed.sql runs (with a doctor present)", seedRes === "ok", seedRes);
  const c = (await db2.query(`select (select count(*) from public.patients)::int p, (select count(*) from public.appointments)::int a,
     (select count(*) from public.invoices)::int i, (select count(*) from public.payments)::int pay,
     (select count(*) from public.medicines)::int m`)).rows[0];
  ok("seed data counts", c.p === 8 && c.a === 6 && c.i === 2 && c.pay === 2 && c.m === 8, JSON.stringify(c));
  r = await as(db2, "authenticated", au, (q) => q("select * from public.v_dashboard_kpis"));
  ok("KPIs after seed", r.ok && r.r[0].total_patients === 8 && Number(r.r[0].revenue_this_month) === 700, JSON.stringify(r));

  const db3 = await setup();
  const seed3 = await db3.exec(read("seed.sql")).then(() => "ok", (e) => e.message);
  ok("seed.sql runs (with NO doctor yet)", seed3 === "ok", seed3);

  console.log("== Bootstrap + reset ==");
  const db4 = await setup();
  await mkUser(db4, "REPLACE-ME@example.com", null, "First");
  const b = await db4.query(read("migrations/0005_bootstrap_admin.sql").split("\n").filter(l => !l.trim().startsWith("--") || true).join("\n")).then((x) => x, (e) => ({ err: e.message }));
  console.log("   (bootstrap multi-stmt via query:", b.err ? b.err : "ok)");
  const db5 = await setup();
  await mkUser(db5, "REPLACE-ME@example.com", null, "First");
  const b5 = await db5.exec(read("migrations/0005_bootstrap_admin.sql")).then(() => "ok", (e) => e.message);
  const pr = (await db5.query("select role,is_active from public.profiles")).rows[0];
  ok("bootstrap promotes first user to active admin", b5 === "ok" && pr.role === "admin" && pr.is_active, b5 + JSON.stringify(pr));

  const rs = await db4.exec(read("dev_reset.sql")).then(() => "ok", (e) => e.message);
  ok("dev_reset.sql runs", rs === "ok", rs);
  const again = await db4.exec(read("all_in_one.sql")).then(() => "ok", (e) => e.message);
  ok("schema can be re-applied after reset", again === "ok", again);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("TEST CRASH", e); process.exit(2); });
