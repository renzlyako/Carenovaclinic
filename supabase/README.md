# Supabase SQL: CareNova Clinic

## How to run (one time only)
1. Supabase Dashboard -> **SQL Editor** -> New query.
2. Paste the **entire `all_in_one.sql`** (= migrations 0001-0004 and 0006-0008; 0005 is step 4 below) -> **Run**.
3. Create the first user: **Authentication -> Users -> Add user -> Create new user** (tick *Auto Confirm User*).
4. Open `migrations/0005_bootstrap_admin.sql`, replace the email, **Run** -> it should return 1 row (role = admin).
5. (Optional) Run `seed.sql` for sample data.

If a run failed and you want to start over: run `dev_reset.sql` (deletes all tables/data, but not accounts), then repeat step 2.

If the SQL Editor says "permission denied for schema public", set the role dropdown next to Run to **postgres** (not `authenticated`).

## Settings in the Supabase Dashboard (SQL cannot do these)
- **Authentication -> Sign In / Providers (or Settings)**: turn **OFF** "Allow new users to sign up" (only admins create accounts).
- Password policy: **minimum length 10** and require lower/upper/numbers/symbols (matches `lib/validators/password.js`).

## Contents
| File | Purpose |
|---|---|
| 0001_schema.sql | Enums, tables, PK/FK, CHECK/UNIQUE, indexes, updated_at triggers |
| 0002_rls_policies.sql | Helper functions, GRANTs (column-level too), RLS policies per role |
| 0003_audit_triggers.sql | Audit triggers (INSERT/UPDATE/DELETE) + append-only audit_logs |
| 0004_functions_views.sql | Auto-profile on signup, business rules, `dispense_prescription()`, `void_invoice()`, dashboard views |
| 0005_bootstrap_admin.sql | Turn the first user into an admin |
| 0006_appointments_doctor_guard.sql | Doctors can only change the status of an appointment |
| 0007_pending_prescriptions.sql | `pending_prescriptions()` for the billing screen |
| 0008_restore_function.sql | `restore_from_backup()`: transactional restore (service role only) |
| seed.sql | Sample patients, medicines, appointments, billing |
| dev_reset.sql | Reset (dev only) |

## For the app code (services)
- Transaction: `supabase.rpc("dispense_prescription", { p_prescription_id, p_invoice_id })`
- Void: `supabase.rpc("void_invoice", { p_invoice_id })`
- Dashboard views: `v_dashboard_kpis`, `v_appointments_per_day`, `v_revenue_monthly`,
  `v_appointment_status_counts`, `v_top_diagnoses`, `v_low_stock_medicines`,
  `v_daily_collection`, `v_patients_per_doctor`
- `invoices.total`, `amount_paid` and `status` are changed by triggers only; never send them from the app.

## Rules (for the defense)
- Doctor: own appointments / patients / consultations only (RLS).
- Receptionist: patients, appointments, billing; no access to consultations.
- Admin: everything + users + audit logs; read-only on consultations.
- audit_logs: append-only (RLS + GRANT + trigger). Payments are permanent records.
- `anon` has no access; the `service_role` key is server-side only.
