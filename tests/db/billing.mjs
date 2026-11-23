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


const db = await fresh();
const files = ["0001_schema.sql","0002_rls_policies.sql","0003_audit_triggers.sql","0004_functions_views.sql","0006_appointments_doctor_guard.sql","0007_pending_prescriptions.sql"];
await db.exec(files.map(f => read("migrations/"+f)).join("\n"));
const mk = async (email, role) => (await db.query("insert into auth.users(email,raw_app_meta_data) values ($1,$2::jsonb) returning id", [email, JSON.stringify({ role })])).rows[0].id;
const admin = await mk("a@x.com","admin"), rec = await mk("r@x.com","receptionist"), d1u = await mk("d1@x.com","doctor"), d2u = await mk("d2@x.com","doctor");
const d1 = (await db.query("insert into public.doctors(profile_id,specialization,license_no) values ($1,'GP','L1') returning id",[d1u])).rows[0].id;
const d2 = (await db.query("insert into public.doctors(profile_id,specialization,license_no) values ($1,'Peds','L2') returning id",[d2u])).rows[0].id;
const pat = (await db.query("insert into public.patients(first_name,last_name,birthdate,sex,contact_no) values ('Maria','Santos','1990-01-01','female','09171234567') returning id")).rows[0].id;
const pat2 = (await db.query("insert into public.patients(first_name,last_name,birthdate,sex,contact_no) values ('Juan','Cruz','1980-01-01','male','09171234568') returning id")).rows[0].id;
const med = (await db.query("insert into public.medicines(name,stock_qty,unit_price) values ('Paracetamol',20,2.5) returning id")).rows[0].id;
const med2 = (await db.query("insert into public.medicines(name,stock_qty,unit_price) values ('Rare',2,50) returning id")).rows[0].id;
const a1 = (await db.query("insert into public.appointments(patient_id,doctor_id,schedule) values ($1,$2,'2031-05-01T01:00:00Z') returning id",[pat,d1])).rows[0].id;
const c1 = (await db.query("insert into public.consultations(appointment_id,diagnosis) values ($1,'Flu') returning id",[a1])).rows[0].id;
const rx1 = (await db.query("insert into public.prescriptions(consultation_id,medicine_id,dosage,qty) values ($1,$2,'1 tab q6h',10) returning id",[c1,med])).rows[0].id;
const rx2 = (await db.query("insert into public.prescriptions(consultation_id,medicine_id,dosage,qty) values ($1,$2,'1 tab',5) returning id",[c1,med2])).rows[0].id;
const run = (uid, sql, p) => as(db, "authenticated", uid, (q) => q(sql, p));

// ---- Medicines (admin only) ----
let r = await run(admin, "insert into public.medicines(name,stock_qty,unit_price) values ('Cetirizine',10,5) returning id");
ok("admin adds medicine", r.ok, r.err); const m3 = r.r?.[0]?.id;
r = await run(admin, "insert into public.medicines(name,stock_qty,unit_price) values ('Cetirizine',10,5)");
ok("duplicate medicine name -> 23505", !r.ok && r.code==="23505", r.code);
r = await run(admin, "insert into public.medicines(name,stock_qty,unit_price) values ('Neg',-1,5)");
ok("negative stock rejected 23514", !r.ok && r.code==="23514", r.code);
r = await run(rec, "insert into public.medicines(name,stock_qty,unit_price) values ('Hack',1,1)");
ok("receptionist cannot add medicine (42501)", !r.ok && r.code==="42501", r.code);
r = await run(d1u, "update public.medicines set unit_price=0 where id=$1 returning id",[med]);
ok("doctor cannot edit medicine (42501 or 0 rows)", (!r.ok && r.code==="42501") || (r.ok && r.r.length===0), r.code);
r = await run(rec, "select id from public.medicines");
ok("receptionist can read medicines", r.ok && r.r.length>=3);
r = await run(admin, "delete from public.medicines where id=$1 returning id",[med]);
ok("medicine used in prescriptions cannot be deleted (23001)", !r.ok && (r.code==="23001"||r.code==="23503"), r.code);
r = await run(admin, "delete from public.medicines where id=$1 returning id",[m3]);
ok("unused medicine can be deleted", r.ok && r.r.length===1, r.err);

// ---- pending_prescriptions (receptionist cannot read consultations but can see this) ----
r = await run(rec, "select * from public.consultations");
ok("receptionist cannot read consultations", r.ok && r.r.length===0);
r = await run(rec, "select medicine_name, qty from public.pending_prescriptions($1) order by medicine_name",[pat]);
ok("receptionist sees pending prescriptions via function", r.ok && r.r.length===2, r.err);
r = await run(d1u, "select * from public.pending_prescriptions($1)",[pat]);
ok("doctor gets nothing from pending_prescriptions", r.ok && r.r.length===0);
r = await run(rec, "select * from public.pending_prescriptions($1)",[pat2]);
ok("other patient has none", r.ok && r.r.length===0);
r = await as(db,"anon",null,(q)=>q("select * from public.pending_prescriptions($1)",[pat]));
ok("anon cannot call pending_prescriptions", !r.ok && r.code==="42501", r.code);

// ---- invoices ----
r = await run(rec, "insert into public.invoices(patient_id,appointment_id,notes) values ($1,$2,'visit') returning id, invoice_no, status, total",[pat,a1]);
ok("receptionist creates invoice (INV-xxxxxx, unpaid, total 0)", r.ok && /^INV-\d{6}$/.test(r.r[0].invoice_no) && r.r[0].status==="unpaid" && Number(r.r[0].total)===0, r.err);
const inv = r.r?.[0]?.id;
r = await run(rec, "insert into public.invoices(patient_id,total,status) values ($1,999,'paid')",[pat]);
ok("client cannot set total/status directly (42501)", !r.ok && r.code==="42501", r.code);
r = await run(d1u, "insert into public.invoices(patient_id) values ($1)",[pat]);
ok("doctor cannot create invoice", !r.ok && r.code==="42501", r.code);
r = await run(rec, "insert into public.invoice_items(invoice_id,description,qty,unit_price) values ($1,'Consultation fee',1,500)",[inv]);
ok("add manual item", r.ok, r.err);
r = await run(rec, "select total, status from public.invoices where id=$1",[inv]);
ok("total recalculated to 500 by trigger", r.ok && Number(r.r[0].total)===500, JSON.stringify(r.r));
r = await run(rec, "insert into public.invoice_items(invoice_id,description,qty,unit_price) values ($1,'x',0,5)",[inv]);
ok("item qty 0 rejected", !r.ok && r.code==="23514", r.code);

// ---- dispense (transaction) ----
r = await run(rec, "select public.dispense_prescription($1,$2) as item",[rx1,inv]);
ok("dispense 10 x Paracetamol", r.ok, r.err);
r = await run(rec, "select stock_qty from public.medicines where id=$1",[med]);
ok("stock reduced 20 -> 10", r.r[0].stock_qty===10, JSON.stringify(r.r));
r = await run(rec, "select total from public.invoices where id=$1",[inv]);
ok("invoice total now 525.00 (500 + 10x2.5)", Number(r.r[0].total)===525, JSON.stringify(r.r));
r = await run(rec, "select public.dispense_prescription($1,$2)",[rx1,inv]);
ok("cannot dispense twice (P0001 message safe)", !r.ok && r.code==="P0001" && /already dispensed/.test(r.err), r.code+r.err);
r = await run(rec, "select public.dispense_prescription($1,$2)",[rx2,inv]);
ok("insufficient stock -> P0001 with readable message", !r.ok && r.code==="P0001" && /Insufficient stock/.test(r.err), r.code+r.err);
r = await run(rec, "select stock_qty from public.medicines where id=$1",[med2]);
ok("failed dispense rolled back (stock still 2)", r.r[0].stock_qty===2);
r = await run(rec, "select dispensed_at from public.prescriptions where id=$1",[rx2]);
ok("failed dispense left prescription pending", r.r[0].dispensed_at===null);
r = await run(d1u, "select public.dispense_prescription($1,$2)",[rx2,inv]);
ok("doctor cannot dispense (42501)", !r.ok && r.code==="42501", r.code);
const invB = (await db.query("insert into public.invoices(patient_id) values ($1) returning id",[pat2])).rows[0].id;
await db.query("update public.medicines set stock_qty=50 where id=$1",[med2]);
r = await run(rec, "select public.dispense_prescription($1,$2)",[rx2,invB]);
ok("cannot dispense onto another patient's invoice", !r.ok && /different patient/.test(r.err), r.err);
r = await run(rec, "delete from public.invoice_items where invoice_id=$1 and medicine_id is null returning id",[inv]);
ok("manual items removable (medicine_id is null)", r.ok && r.r.length===1, r.err);
r = await run(rec, "delete from public.invoice_items where invoice_id=$1 and medicine_id is null returning id",[inv]);
ok("medicine items are not matched by the manual-delete query", r.ok && r.r.length===0);
r = await run(rec, "insert into public.invoice_items(invoice_id,description,qty,unit_price) values ($1,'Consultation fee',1,500)",[inv]);

// ---- payments ----
r = await run(rec, "insert into public.payments(invoice_id,amount,method) values ($1,1000,'cash')",[inv]);
ok("overpayment rejected with readable message", !r.ok && r.code==="P0001" && /exceeds the remaining balance/.test(r.err), r.code+r.err);
r = await run(rec, "insert into public.payments(invoice_id,amount,method,reference_no) values ($1,200,'gcash','REF1')",[inv]);
ok("partial payment accepted", r.ok, r.err);
r = await run(rec, "select status, amount_paid from public.invoices where id=$1",[inv]);
ok("status partial, paid 200", r.r[0].status==="partial" && Number(r.r[0].amount_paid)===200, JSON.stringify(r.r));
r = await run(rec, "insert into public.payments(invoice_id,amount,method) values ($1,325,'cash')",[inv]);
r = await run(rec, "select status from public.invoices where id=$1",[inv]);
ok("fully paid -> status paid", r.r[0].status==="paid");
r = await run(rec, "insert into public.payments(invoice_id,amount,method) values ($1,1,'cash')",[inv]);
ok("cannot pay a paid invoice", !r.ok && /already fully paid/.test(r.err), r.err);
r = await run(rec, "insert into public.invoice_items(invoice_id,description,qty,unit_price) values ($1,'late',1,1)",[inv]);
ok("cannot add items to a paid invoice", !r.ok && /Cannot modify items of a paid invoice/.test(r.err), r.err);
r = await run(admin, "update public.payments set amount=1 returning id");
ok("payments cannot be edited (even by admin)", !r.ok, r.err);
r = await run(admin, "delete from public.payments returning id");
ok("payments cannot be deleted (even by admin)", !r.ok, r.err);
r = await run(admin, "select public.void_invoice($1)",[inv]);
ok("cannot void an invoice with payments", !r.ok && /already has payments/.test(r.err), r.err);
r = await run(rec, "select public.void_invoice($1)",[invB]);
ok("receptionist cannot void (42501)", !r.ok && r.code==="42501", r.code);
r = await run(admin, "select public.void_invoice($1)",[invB]);
ok("admin voids unpaid invoice", r.ok, r.err);
r = await run(rec, "insert into public.payments(invoice_id,amount,method) values ($1,1,'cash')",[invB]);
ok("cannot pay a void invoice", !r.ok, r.err);

// ---- doctor read-only on own invoices ----
r = await run(d1u, "select id from public.invoices");
ok("doctor sees invoice of own appointment only", r.ok && r.r.length===1 && r.r[0].id===inv, JSON.stringify(r.r));
r = await run(d2u, "select id from public.invoices");
ok("other doctor sees none", r.ok && r.r.length===0);
r = await run(d1u, "select id from public.payments");
ok("doctor can read payments of own invoice", r.ok && r.r.length===2);

// ---- audit ----
const au = (await db.query("select action, table_name from public.audit_logs where table_name in ('invoices','payments','medicines','invoice_items')")).rows;
ok("audit trail covers invoices, payments, medicines", ['invoices','payments','medicines','invoice_items'].every(t=>au.some(x=>x.table_name===t)));
console.log(pass,"pass",fail,"fail");
