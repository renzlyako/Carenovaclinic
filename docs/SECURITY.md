# Security Controls (with evidence)

| # | Requirement | Implementation | Evidence |
|---|---|---|---|
| 1 | Secure authentication | Supabase Auth; session cookies via `@supabase/ssr`; middleware redirects anonymous users; disabled accounts are refused at login | `tests/db/schema_rls_audit.mjs` (inactive user sees nothing); manual: disabled user -> LOGIN_FAILED in audit log |
| 2 | Password hashing | Supabase Auth stores bcrypt hashes in `auth.users`; the app never sees or stores passwords in its own tables | Dashboard -> Authentication -> Users (no plain text anywhere) |
| 3 | Strong password policy | zod `passwordSchema` (min 10, upper, lower, digit, special) + the same minimum in Supabase Auth settings | `tests/unit/security.mjs` (6 weak-password cases rejected) |
| 4 | Input validation | 3 layers: HTML attributes (client), zod in every Server Action / route (server), CHECK / NOT NULL / UNIQUE / FK / enums (database) | `tests/unit/*.mjs`, CHECK tests in `tests/db/*.mjs` |
| 5 | SQL-injection protection | Only the Supabase client and RPC with typed parameters (no string-built SQL); search text is stripped of filter metacharacters; PL/pgSQL functions have no dynamic SQL | `tests/db/security.mjs` (4 payloads stored as plain text, tables intact, no escalation, malformed uuid rejected) |
| 6 | Authorization (RBAC) | Middleware + `requireRole()` / `requireApiRole()` + Row Level Security on every table + column-level GRANTs | RBAC matrix in `docs/TEST_CASES.md`; `tests/db/security.mjs` |
| 7 | Audit trail | AFTER triggers on all data tables record user, email, action, old/new data; app events (LOGIN, LOGIN_FAILED, LOGOUT, ADMIN_*, BACKUP, RESTORE, REPORT_EXPORT) are written by the server | `/admin/audit-logs`; `tests/db/schema_rls_audit.mjs` |
| 8 | Audit trail cannot be modified or deleted | RLS has no UPDATE/DELETE policy + privileges REVOKEd + BEFORE UPDATE/DELETE/TRUNCATE trigger that raises an error (blocks even the table owner) | tests: admin, service_role and superuser attempts all fail |
| 9 | Secrets | `SUPABASE_SERVICE_ROLE_KEY` is used only in server-only modules (`import "server-only"`), never `NEXT_PUBLIC_`; `.env.local` is git-ignored | `src/lib/supabase/admin.js` |
| 10 | No self-signup | Signup disabled in Supabase; a user without an admin-assigned role gets an **inactive** profile | tests: "self-signup (no app role) is INACTIVE" |
| 11 | Data integrity rules | Trigger-maintained invoice totals/status, immutable payments, last-admin guard, doctor-role check, no double-booking, locked prescriptions | tests in `tests/db/billing.mjs`, `appointments.mjs` |
| 12 | Safe backup / restore | Admin only; restore runs as one transaction (all or nothing), validates the file first, executable only by `service_role` | `tests/db/restore.mjs`; `restore_from_backup` denied to admin/receptionist/doctor/anon in `security.mjs` |
| 13 | Safe exports | CSV values starting with `=`, `+`, `-`, `@` are prefixed with `'` (formula injection) | `tests/unit/security.mjs` |
| 14 | Security headers | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` in `next.config.mjs` | browser dev tools -> response headers |

## Known limits (honest notes for the defense)
- Login rate limiting / lockout relies on Supabase's built-in auth rate limits; the app has no custom lockout.
- Users cannot change their own password in the app; an admin resets it.
- Backups are plain JSON and contain patient data: store them securely (no encryption layer in the app).
- The JSON backup does not restore accounts/audit logs; the `scripts/backup.sh` / `restore.sh` pair makes a full database copy.
