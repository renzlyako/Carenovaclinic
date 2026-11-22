# Test Cases

Automated: run `npm test` (no Supabase account needed; the database tests run the real migrations on PostgreSQL via PGlite with mocked Supabase roles).
Manual: the table "Manual checks" below, to repeat in the browser during the demo.

## 1. RBAC matrix
Legend: C create, R read, U update, D delete, - none, own = only rows linked to that doctor.

| Module | Admin | Doctor | Receptionist |
|---|---|---|---|
| Dashboard | all KPIs | own KPIs | clinic KPIs, no diagnoses |
| Patients | C R U D | R (own patients) | C R U D |
| Appointments | C R U D | R own; change status of own | C R U (cancel) |
| Consultations | R | C R U own | - |
| Prescriptions | R | C R U own (until dispensed) | - |
| Medicines | C R U | R | R |
| Invoices / payments | C R U, void | R (own appointments) | C R, add payments |
| Reports | all (incl. top diagnoses) | - | all except top diagnoses |
| User management | C R U | - | - |
| Audit logs | R | - | - |
| Backup / restore / monitoring | yes | - | - |
| Payments edit/delete | never | never | never |
| Audit logs edit/delete | never | never | never |

## 2. Automated suites
| File | Covers |
|---|---|
| `tests/db/schema_rls_audit.mjs` | schema, RLS per role, constraints, billing triggers, rollback, audit immutability, last-admin guard, seed, reset |
| `tests/db/patients.mjs`, `appointments.mjs`, `consultations.mjs`, `billing.mjs`, `dashboard.mjs` | module-level rules and RLS |
| `tests/db/restore.mjs` | transactional restore, rollback on bad data, permissions |
| `tests/db/security.mjs` | SQL-injection payloads, RBAC reads/writes, privilege escalation, restore permission, audit tampering |
| `tests/unit/*.mjs` | zod validators, password policy, CSV formula safety, charts, backup file parsing |

## 3. Security test cases
| ID | Test | Expected | Automated |
|---|---|---|---|
| S1 | Patient name `Robert'); DROP TABLE patients;--` | stored as text; table intact | security.mjs |
| S2 | `' OR '1'='1` in text and in a search | stored literally; search matches nothing | security.mjs |
| S3 | `'; UPDATE profiles SET role='admin'...` as a value | no role changes | security.mjs |
| S4 | Injection string as an RPC uuid parameter | error 22P02, nothing executed | security.mjs |
| S5 | Receptionist updates own role to admin | role unchanged | security.mjs |
| S6 | Doctor deactivates the admin | no change | security.mjs |
| S7 | Admin/receptionist/doctor/anon call `restore_from_backup` | permission denied | security.mjs |
| S8 | Anyone but admin reads `audit_logs` | denied or 0 rows | security.mjs |
| S9 | Admin edits or deletes audit logs | no effect | security.mjs, schema_rls_audit.mjs |
| S10 | Weak passwords (6 variants) | rejected | unit/security.mjs |
| S11 | CSV cell starting with `=`, `+`, `@` | prefixed with `'` | unit/security.mjs |
| S12 | Self-signup without admin role | profile inactive, cannot use app | schema_rls_audit.mjs |

## 4. Manual checks (browser)
| ID | Steps | Expected |
|---|---|---|
| M1 | Log in with a wrong password | generic error; LOGIN_FAILED in audit log |
| M2 | Receptionist opens `/admin/users` or `/consultations` | redirected to Unauthorized |
| M3 | Doctor opens `/billing/new` or edits a patient | not offered / refused |
| M4 | Book the same doctor and time twice | friendly double-booking error |
| M5 | Dispense a prescription with too little stock | error; stock, invoice, prescription unchanged |
| M6 | Pay more than the balance | rejected |
| M7 | Pay in two parts | status unpaid -> partial -> paid |
| M8 | Disable a user, then that user logs in | login refused |
| M9 | Demote or disable the only admin | refused |
| M10 | Download a backup, change data, restore | data returns; RESTORE logged |
| M11 | Restore a corrupted/edited JSON file | rejected; no data changed |
| M12 | Export a report as CSV | file opens correctly; EXPORT logged |
