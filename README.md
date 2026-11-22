# CareNova Family Clinic
**Patient, Appointment & Billing Management System** - Advanced Database final project.

A database-driven web app for a small clinic: patient records, appointments, consultations and prescriptions, medicine stock, invoicing and payments, an interactive dashboard with reports, and full database administration (users, audit trail, backup and restore).

**Stack:** Next.js 15 (App Router) - Supabase (PostgreSQL, Auth, Row Level Security) - Tailwind CSS - Recharts

## Features
| Area | What it does |
|---|---|
| Patients | Full CRUD, search, auto patient number (`P-00001`), validated contact data |
| Appointments | Booking with no double-booking (unique index), status workflow, doctor-only status changes |
| Consultations / Prescriptions | Doctors record diagnosis and prescribe medicines; dispensing locks the prescription |
| Medicines | Catalog and stock levels, low-stock alerts |
| Billing | Invoices, items, payments (immutable), void; totals/status maintained by triggers |
| Dashboard and Reports | Role-aware KPIs and charts; six reports with CSV export |
| User management (Admin) | Create users, change role, enable/disable, reset password |
| Audit trail (Admin) | Logins, creates, updates, deletes and admin actions; append-only |
| Backup / Restore (Admin) | JSON backup download, transactional restore, record monitoring, history |

Roles: **Admin** (everything + administration) and **Standard users** (**Doctor**, **Receptionist**) with limited access. See `docs/TEST_CASES.md` for the full role matrix.

## Setup
```bash
npm install
cp .env.example .env.local      # Windows: copy .env.example .env.local, then fill in the Supabase keys
npm run dev                     # http://localhost:3000
```
Database setup (SQL, first admin, Supabase dashboard settings): see `supabase/README.md`.

## Scripts
| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Run the app |
| `npm test` | All automated tests (about 300 checks, no Supabase account needed) |
| `npm run test:unit` | Validator / utility tests only |
| `npm run test:db` | Database tests only (real PostgreSQL in WebAssembly via PGlite) |

## Documentation
| File | Content |
|---|---|
| `docs/ERD.md`, `docs/ERD.png` | Entity-relationship diagram and design notes |
| `docs/SECURITY.md` | Security controls with evidence |
| `docs/DEFENSE_NOTES.md` | Questions and answers for the defense |
| `docs/DEMO_SCRIPT.md` | Ordered live-demo script |
| `docs/TEST_CASES.md` | RBAC matrix and test cases |
| `docs/API.md` | Route handlers |

## Project structure
```
src/
  app/            Pages (App Router) and /api routes
    (auth)/login
    (dashboard)/  dashboard, patients, appointments, consultations, medicines,
                  billing, reports, admin/{users,audit-logs,backup}
    api/          admin/{users,backup,restore,audit-logs}, dashboard/summary, reports
  components/     ui, layout, charts, dashboard, per-module components
  lib/            supabase clients, auth guards, validators (zod), constants, utils
  services/       data access (Supabase queries)
  actions/        Server Actions (login and CRUD)
supabase/         migrations 0001-0008 (all_in_one.sql = all except 0005), seed.sql, dev_reset.sql
tests/            unit/ and db/ test files, runner
docs/             documentation
scripts/          backup.sh / restore.sh (pg_dump / psql, full database copy)
```

## Security in layers
1. **Middleware**: login and role check on every route.
2. **Server guards**: `requireRole()` / `requireApiRole()` in pages, actions and API routes.
3. **Row Level Security** in PostgreSQL: the final barrier, enforced inside the database.
4. **Constraints and triggers**: business rules that cannot be bypassed by any client.
