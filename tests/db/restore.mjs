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
const files = ["0001_schema.sql","0002_rls_policies.sql","0003_audit_triggers.sql","0004_functions_views.sql","0006_appointments_doctor_guard.sql","0007_pending_prescriptions.sql","0008_restore_function.sql"];
await db.exec(files.map(f => read("migrations/"+f)).join("\n"));
const mk = async (email, role) => (await db.query("insert into auth.users(email,raw_app_meta_data) values ($1,$2::jsonb) returning id", [email, JSON.stringify({ role })])).rows[0].id;
const admin = await mk("a@x.com","admin"), rec = await mk("r@x.com","receptionist"), d1u = await mk("d1@x.com","doctor");
const d1 = (await db.query("insert into public.doctors(profile_id,specialization,license_no) values ($1,'GP','L1') returning id",[d1u])).rows[0].id;
const P = async (n)=> (await db.query("insert into public.patients(first_name,last_name,birthdate,sex,contact_no) values ($1,'T','1990-01-01','male','09171234567') returning id",[n])).rows[0].id;
const [p1,p2] = [await P("A"),await P("B")];
const med = (await db.query("insert into public.medicines(name,stock_qty,unit_price) values ('Para',100,2.5) returning id")).rows[0].id;
const a1 = (await db.query("insert into public.appointments(patient_id,doctor_id,schedule,status,created_by) values ($1,$2,'2031-05-01T01:00:00Z','completed',$3) returning id",[p1,d1,rec])).rows[0].id;
const c1 = (await db.query("insert into public.consultations(appointment_id,diagnosis,notes) values ($1,'Flu','n') returning id",[a1])).rows[0].id;
const rx = (await db.query("insert into public.prescriptions(consultation_id,medicine_id,dosage,qty) values ($1,$2,'1 tab',10) returning id",[c1,med])).rows[0].id;
const inv = (await db.query("insert into public.invoices(patient_id,appointment_id,created_by) values ($1,$2,$3) returning id",[p1,a1,rec])).rows[0].id;
await db.query("insert into public.invoice_items(invoice_id,description,qty,unit_price) values ($1,'Fee',1,500)",[inv]);
await db.query("insert into public.payments(invoice_id,amount,method,received_by) values ($1,200,'cash',$2),($1,100,'gcash',$2)",[inv,rec]);
const run = (uid, sql, p) => as(db, "authenticated", uid, (q) => q(sql, p));

// ---- build a "backup" the same way the app does (PostgREST returns each row as JSON, generated columns included) ----
const TB = ["patients","medicines","appointments","consultations","prescriptions","invoices","invoice_items","payments","profiles","doctors"];
const snap = async () => { const o={}; for (const t of TB) o[t]=(await db.query(`select to_jsonb(x) as j from public.${t} x order by 1`)).rows.map(r=>r.j); return o; };
const backup = await snap();
const counts = async () => { const o={}; for (const t of TB.slice(0,8)) o[t]=Number((await db.query(`select count(*) c from public.${t}`)).rows[0].c); return o; };
const before = await counts();
const sum = async () => (await db.query("select (select sum(amount_paid) from public.invoices) paid, (select sum(total) from public.invoices) total, (select status from public.invoices limit 1) st")).rows[0];
const s0 = await sum();
const auditN = async () => Number((await db.query("select count(*) c from public.audit_logs")).rows[0].c);
const a0 = await auditN();
const trgOn = async () => (await db.query("select count(*) c from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal and t.tgenabled <> 'O'")).rows[0].c;

// ---- disaster: wipe data (as postgres) ----
await db.exec("set session_replication_role = replica");
await db.exec("delete from public.payments; delete from public.invoice_items; delete from public.invoices; delete from public.prescriptions; delete from public.consultations; delete from public.appointments; delete from public.medicines; delete from public.patients;");
await db.exec("set session_replication_role = origin");
let r = await db.query("select count(*) c from public.patients");
ok("data wiped", Number(r.rows[0].c)===0);

// ---- permissions ----
r = await run(admin, "select public.restore_from_backup($1::jsonb)", [JSON.stringify(backup)]);
ok("authenticated (even admin) cannot call restore directly (42501)", !r.ok && r.code==="42501", r.code);
r = await as(db,"anon",null,(q)=>q("select public.restore_from_backup($1::jsonb)",[JSON.stringify(backup)]));
ok("anon cannot call restore", !r.ok && r.code==="42501", r.code);
r = await as(db,"service_role",null,(q)=>q("select public.restore_from_backup($1::jsonb) as res",[JSON.stringify(backup)]));
ok("service_role restores the backup", r.ok, r.err);
ok("restore result lists the counts", r.r?.[0]?.res?.restored?.patients===2, JSON.stringify(r.r));
const after = await counts();
ok("all row counts identical to before", JSON.stringify(after)===JSON.stringify(before), JSON.stringify(after));
const s1 = await sum();
ok("invoice totals/paid/status NOT double-counted", Number(s1.paid)===Number(s0.paid) && Number(s1.total)===Number(s0.total) && s1.st===s0.st, JSON.stringify([s0,s1]));
const back2 = await snap();
ok("restored data equals the backup (including generated patient_no / invoice_no / line_total)", JSON.stringify(back2)===JSON.stringify(backup));
ok("row-level triggers are enabled again", Number(await trgOn())===0, await trgOn());
ok("audit trail not flooded by the restore (no row events added)", (await auditN())===a0, await auditN()+" vs "+a0);
r = await run(rec, "insert into public.patients(first_name,last_name,birthdate,sex,contact_no) values ('New','One','2000-01-01','male','09171234567') returning patient_no");
ok("identity counter continues after restore (P-00003)", r.ok && r.r[0].patient_no==="P-00003", JSON.stringify(r.r)+r.err);
r = await run(rec, "insert into public.invoices(patient_id) values ($1) returning invoice_no",[p1]);
ok("invoice counter continues (INV-000002)", r.ok && r.r[0].invoice_no==="INV-000002", JSON.stringify(r.r)+r.err);
r = await db.query("update public.payments set amount=1").then(()=>({ok:true}),(e)=>({ok:false,err:e.message}));
ok("payment lock trigger works again after restore (even for the table owner)", !r.ok && /permanent records/.test(r.err), r.err);
r = await run(rec, "insert into public.payments(invoice_id,amount,method) values ($1,1000,'cash')",[inv]);
ok("payment guard works again (paid invoice)", !r.ok, r.err);
const a2 = await auditN();
await run(rec, "insert into public.patients(first_name,last_name,birthdate,sex,contact_no) values ('Audit','Check','2000-01-01','male','09171234567')");
ok("audit trigger works again", (await auditN())===a2+1);

// ---- restore twice (idempotent) ----
r = await as(db,"service_role",null,(q)=>q("select public.restore_from_backup($1::jsonb)",[JSON.stringify(backup)]));
ok("second restore also works (replaces current data)", r.ok, r.err);
r = await db.query("select count(*) c from public.patients");
ok("data replaced (extra patients are gone)", Number(r.rows[0].c)===2);

// ---- all-or-nothing ----
const snapBefore = JSON.stringify(await snap());
const bad = JSON.parse(JSON.stringify(backup)); bad.payments[0].amount = "not-a-number";
r = await as(db,"service_role",null,(q)=>q("select public.restore_from_backup($1::jsonb)",[JSON.stringify(bad)]));
ok("invalid value -> readable error", !r.ok && /invalid format/.test(r.err), r.err);
ok("failed restore changed NOTHING (rolled back)", JSON.stringify(await snap())===snapBefore);
ok("triggers still enabled after a failed restore", Number(await trgOn())===0);
const bad2 = JSON.parse(JSON.stringify(backup)); bad2.appointments[0].doctor_id = "00000000-0000-0000-0000-000000000000";
r = await as(db,"service_role",null,(q)=>q("select public.restore_from_backup($1::jsonb)",[JSON.stringify(bad2)]));
ok("missing doctor -> friendly FK message", !r.ok && /does not exist in this database/.test(r.err), r.err);
ok("still unchanged after the FK failure", JSON.stringify(await snap())===snapBefore);
const bad3 = JSON.parse(JSON.stringify(backup)); delete bad3.payments;
r = await as(db,"service_role",null,(q)=>q("select public.restore_from_backup($1::jsonb)",[JSON.stringify(bad3)]));
ok("missing table -> clear message", !r.ok && /table "payments" is missing/.test(r.err), r.err);
r = await as(db,"service_role",null,(q)=>q("select public.restore_from_backup($1::jsonb)",["[1,2]"]));
ok("non-object file rejected", !r.ok && /no table data/.test(r.err), r.err);
ok("still unchanged", JSON.stringify(await snap())===snapBefore);

// ---- user that no longer exists: the row is kept, the reference is cleared ----
const ghost = JSON.parse(JSON.stringify(backup)); ghost.invoices[0].created_by = "11111111-1111-1111-1111-111111111111"; ghost.payments[0].received_by="11111111-1111-1111-1111-111111111111";
r = await as(db,"service_role",null,(q)=>q("select public.restore_from_backup($1::jsonb)",[JSON.stringify(ghost)]));
ok("unknown created_by/received_by does not break the restore", r.ok, r.err);
r = await db.query("select created_by from public.invoices limit 1");
ok("reference cleared (null)", r.rows[0].created_by===null);
// ---- extra keys (profiles/doctors) are ignored ----
ok("profiles/doctors untouched", Number((await db.query("select count(*) c from public.profiles")).rows[0].c)===3 && Number((await db.query("select count(*) c from public.doctors")).rows[0].c)===1);
console.log(pass,"pass",fail,"fail");
