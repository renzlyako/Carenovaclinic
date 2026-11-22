# API Routes (Next.js route handlers)

All routes require a signed-in, active user. Role checks use `requireApiRole()`; the database enforces RLS on top. Errors return JSON `{ "error": "..." }` with 401 (not signed in), 403 (wrong role) or 400 (invalid input).

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET / POST | /api/admin/users | Admin | List / create a user (+ doctor profile when role is doctor) |
| PATCH | /api/admin/users/:id | Admin | Change role, enable/disable, reset password |
| GET | /api/admin/audit-logs | Admin | Read-only, filtered audit logs |
| GET | /api/admin/backup | Admin | Download a JSON backup (logged as BACKUP) |
| POST | /api/admin/restore | Admin | Restore from a backup file, one transaction (logged as RESTORE) |
| GET | /api/dashboard/summary | Any signed-in role | KPIs and chart data, limited by the role's RLS |
| GET | /api/reports?type=...&format=csv | Admin, Receptionist | Report data or CSV export (logged as REPORT_EXPORT) |

Report types: `daily_collection`, `outstanding_invoices`, `patients_per_doctor`, `appointment_status`, `top_diagnoses` (Admin only), `low_stock`.

Most create/update/delete operations are Server Actions (`src/actions/*`), not public REST endpoints. They validate with zod, run through the user's own Supabase session (so RLS applies) and return friendly messages for database errors.

Database functions called through RPC: `dispense_prescription`, `void_invoice`, `pending_prescriptions`, `restore_from_backup` (service role only).
