# Demo Script (about 12-15 minutes)

Prepare: three accounts (admin, doctor, receptionist), seed data loaded, three browser profiles or a private window per role. Have `docs/ERD.png` and a terminal with `npm test` ready.

1. **Design (1 min)** - show `docs/ERD.png`: 11 tables, PK/FK, constraints, no-double-booking index.
2. **Login and authentication (1 min)** - wrong password (shows generic error), then log in as Admin. Mention bcrypt and the password policy.
3. **Dashboard (1 min)** - KPIs and charts as Admin; compare with the Doctor dashboard later.
4. **CRUD + validation (2 min)** - Admin or Receptionist: add a patient with an invalid phone (rejected), then valid; edit; search.
5. **Appointments (1 min)** - book an appointment, then try the same doctor/time again -> friendly double-booking error.
6. **Doctor role (2 min)** - log in as Doctor: only own appointments/patients; start a consultation, add a diagnosis and a prescription.
7. **Billing + transaction (2 min)** - Receptionist: create an invoice, dispense the prescription (stock decreases, item appears). Then try to dispense more than the stock -> error and **nothing changes** (rollback). Add a partial then full payment (status changes); show that a paid invoice cannot be changed.
8. **RBAC (1 min)** - Receptionist menu has no Consultations / Admin; typing `/admin/users` in the URL redirects to Unauthorized.
9. **Reports (1 min)** - run a report, export CSV.
10. **User management (1 min)** - Admin: create a user, change role, disable it; the disabled user cannot log in.
11. **Audit trail (1 min)** - filter by action: LOGIN_FAILED, UPDATE, DELETE, ADMIN_*. Explain that it cannot be edited or deleted (show the SQL attempt failing, or `npm run test:db`).
12. **Backup / restore + monitoring (2 min)** - Record monitoring table; download backup; make a change; restore; show the data returned and the RESTORE log entry; upload an invalid file -> rejected.
13. **Automated tests (1 min)** - run `npm test` -> all test files pass (RBAC, RLS, injection payloads, rollback, restore).

Tip: if a question is asked about "why", point to `docs/DEFENSE_NOTES.md`.
