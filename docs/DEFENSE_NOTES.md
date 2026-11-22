# Defense Notes

## 1. Why PostgreSQL / Supabase? Why relational?
Clinic data is highly connected (patient -> appointment -> consultation -> prescription -> invoice -> payment) and money and stock must stay correct. A relational database gives foreign keys, constraints, transactions and triggers, so correctness is enforced by the database itself. Supabase adds hosted PostgreSQL, Auth (bcrypt) and Row Level Security with no custom server to maintain.

## 2. Explain the ERD and normalization
See `docs/ERD.md`. 11 tables, each fact in one place (3NF). Many-to-many relations are resolved by `prescriptions` and `invoice_items`. Derived values (`patient_no`, `invoice_no`, `line_total`, invoice totals/status) are generated or trigger-maintained so clients cannot falsify them. The only intentional duplication is `invoice_items.unit_price` (price at billing time).

## 3. How are passwords hashed? Where?
By Supabase Auth, with bcrypt, inside `auth.users`. The app never stores or logs passwords. The policy (min 10, upper, lower, digit, special) is checked by zod in the app and by Supabase Auth settings.

## 4. What is RLS and how is it used here?
Row Level Security makes PostgreSQL filter rows per request based on the signed-in user (`auth.uid()`). Examples: a doctor sees only their own appointments, patients and consultations; a receptionist sees no consultations (diagnoses); only admin reads audit logs. Even if the app had a bug or someone called the API directly, the database still refuses. Column-level GRANTs add more (e.g. clients cannot write `invoices.total`).

## 5. How do you prevent SQL injection?
No SQL is built from strings: all queries go through the Supabase client (parameterized) or RPC functions with typed parameters; search text is stripped of filter metacharacters. Demo: `npm run test:db` includes payloads like `Robert'); DROP TABLE patients;--` that are stored as plain text.

## 6. How are audit logs protected?
Three independent layers: no UPDATE/DELETE policy in RLS, privileges revoked, and a trigger that raises an error on UPDATE/DELETE/TRUNCATE (works even for the table owner). Entries are written by triggers (data changes) and by the server (logins, admin actions), so users cannot skip them.

## 7. Transactions: show a rollback
`dispense_prescription()` runs in one transaction: it locks the medicine row, checks stock, reduces stock, adds the invoice item and marks the prescription dispensed. With insufficient stock it raises an error and **nothing** changes (stock, prescription and invoice stay as before). Restore is also one transaction.

## 8. Show backup and restore
Admin -> Backup & Restore: download the JSON; restore it (all-or-nothing); an invalid or tampered file is rejected before anything changes; both actions appear in the audit log. Full database copy with `scripts/backup.sh` / `restore.sh`.

## 9. How do you stop double-booking?
A partial unique index on `(doctor_id, schedule) WHERE status <> 'cancelled'`. Two receptionists clicking at the same moment cannot both succeed; the second gets a friendly error. A cancelled slot can be booked again.

## 10. Why are payments immutable?
Financial records must not be silently changed. A trigger blocks UPDATE/DELETE on `payments` (even for superuser); corrections are made by voiding an unpaid invoice or adding a new record.

## 11. What stops the last admin from locking everyone out?
A trigger refuses to deactivate, demote or delete the last active admin.

## 12. Difference between Admin and Standard users?
Admin: everything plus user management, audit logs, backup/restore, record monitoring and the top-diagnoses report. Standard users are Doctor (own patients and consultations, prescribing, status changes) and Receptionist (patients, appointments, billing, reports, no diagnoses).

## 13. What would you improve next?
Self-service password change and MFA, custom login lockout, encrypted backups, scheduled automatic backups, e-mail/SMS reminders.
