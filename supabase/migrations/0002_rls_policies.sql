-- =====================================================================
-- 0002_rls_policies.sql
-- Helper functions, GRANTs, Row Level Security (RBAC enforced inside the database itself)
--
-- Postgres roles (provided by Supabase):
--   anon           = not logged in           -> NO access to anything
--   authenticated  = logged in (admin/doctor/receptionist; separated by RLS)
--   service_role   = server only (secret key); bypasses RLS
-- =====================================================================

-- ---------- HELPER FUNCTIONS ----------
-- SECURITY DEFINER: they can read profiles/doctors even with RLS enabled, so
-- there is no infinite recursion when they are used inside policies.

create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function public.current_doctor_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select d.id
  from public.doctors d
  join public.profiles p on p.id = d.profile_id
  where d.profile_id = auth.uid() and p.is_active
$$;

create or replace function public.doctor_owns_appointment(p_appointment_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.appointments a
    where a.id = p_appointment_id and a.doctor_id = public.current_doctor_id()
  )
$$;

create or replace function public.doctor_owns_consultation(p_consultation_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.consultations c
    join public.appointments a on a.id = c.appointment_id
    where c.id = p_consultation_id and a.doctor_id = public.current_doctor_id()
  )
$$;

create or replace function public.doctor_has_patient(p_patient_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.appointments a
    where a.patient_id = p_patient_id and a.doctor_id = public.current_doctor_id()
  )
$$;

revoke all on function public.current_user_role()              from public, anon;
revoke all on function public.current_doctor_id()              from public, anon;
revoke all on function public.doctor_owns_appointment(uuid)    from public, anon;
revoke all on function public.doctor_owns_consultation(uuid)   from public, anon;
revoke all on function public.doctor_has_patient(uuid)         from public, anon;
grant execute on function public.current_user_role()            to authenticated, service_role;
grant execute on function public.current_doctor_id()            to authenticated, service_role;
grant execute on function public.doctor_owns_appointment(uuid)  to authenticated, service_role;
grant execute on function public.doctor_owns_consultation(uuid) to authenticated, service_role;
grant execute on function public.doctor_has_patient(uuid)       to authenticated, service_role;

-- ---------- GRANTS (table privileges) ----------
-- "Automatically expose new tables" is off in Supabase, so every privilege is granted manually here.
grant usage on schema public to anon, authenticated, service_role;

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

-- authenticated: RLS decides who is allowed to see or change each row.
grant select on
  public.profiles, public.doctors, public.patients, public.medicines,
  public.appointments, public.consultations, public.prescriptions,
  public.invoices, public.invoice_items, public.payments, public.audit_logs
to authenticated;

grant update (full_name, role, is_active) on public.profiles to authenticated;
grant insert, update, delete on public.doctors       to authenticated;
grant insert, update, delete on public.patients      to authenticated;
grant insert, update, delete on public.medicines     to authenticated;
grant insert, update, delete on public.appointments  to authenticated;
grant insert, update, delete on public.consultations to authenticated;

-- Column-level: the client cannot touch dispensed_at / dispensed_by.
grant insert (consultation_id, medicine_id, dosage, qty) on public.prescriptions to authenticated;
grant update (medicine_id, dosage, qty)                  on public.prescriptions to authenticated;
grant delete                                             on public.prescriptions to authenticated;

-- Column-level: total / amount_paid / status are changed by triggers only.
grant insert (patient_id, appointment_id, notes) on public.invoices to authenticated;
grant update (notes)                             on public.invoices to authenticated;
grant delete                                     on public.invoices to authenticated;

grant insert (invoice_id, description, qty, unit_price) on public.invoice_items to authenticated;
grant update (description, qty, unit_price)             on public.invoice_items to authenticated;
grant delete                                            on public.invoice_items to authenticated;

-- Payments: insert only (financial records can no longer be changed).
grant insert (invoice_id, amount, method, reference_no) on public.payments to authenticated;

-- service_role (server-side admin features: backup, user management, audit events)
grant select, insert, update, delete on all tables in schema public to service_role;
-- Even service_role cannot edit or delete audit logs:
revoke update, delete, truncate on public.audit_logs from service_role;

-- ---------- ENABLE ROW LEVEL SECURITY ----------
alter table public.profiles      enable row level security;
alter table public.doctors       enable row level security;
alter table public.patients      enable row level security;
alter table public.medicines     enable row level security;
alter table public.appointments  enable row level security;
alter table public.consultations enable row level security;
alter table public.prescriptions enable row level security;
alter table public.invoices      enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments      enable row level security;
alter table public.audit_logs    enable row level security;

-- ---------- POLICIES ----------

-- profiles: all active staff can read (e.g. to show doctor names); only admins can edit.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.current_user_role()) is not null);
create policy profiles_update_admin on public.profiles for update to authenticated
  using      ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

-- doctors
create policy doctors_select on public.doctors for select to authenticated
  using ((select public.current_user_role()) is not null);
create policy doctors_insert_admin on public.doctors for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');
create policy doctors_update_admin on public.doctors for update to authenticated
  using      ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');
create policy doctors_delete_admin on public.doctors for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

-- patients: admin/receptionist see all; a doctor sees only patients who have an appointment with them.
create policy patients_select on public.patients for select to authenticated
  using (
    (select public.current_user_role()) in ('admin', 'receptionist')
    or ((select public.current_user_role()) = 'doctor' and public.doctor_has_patient(id))
  );
create policy patients_insert on public.patients for insert to authenticated
  with check ((select public.current_user_role()) in ('admin', 'receptionist'));
create policy patients_update on public.patients for update to authenticated
  using      ((select public.current_user_role()) in ('admin', 'receptionist'))
  with check ((select public.current_user_role()) in ('admin', 'receptionist'));
create policy patients_delete_admin on public.patients for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

-- medicines: readable by all; only admins edit (stock is also changed by the dispense function).
create policy medicines_select on public.medicines for select to authenticated
  using ((select public.current_user_role()) is not null);
create policy medicines_insert_admin on public.medicines for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');
create policy medicines_update_admin on public.medicines for update to authenticated
  using      ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');
create policy medicines_delete_admin on public.medicines for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

-- appointments: admin/receptionist see all; a doctor sees only their own appointments.
create policy appointments_select on public.appointments for select to authenticated
  using (
    (select public.current_user_role()) in ('admin', 'receptionist')
    or ((select public.current_user_role()) = 'doctor' and doctor_id = (select public.current_doctor_id()))
  );
create policy appointments_insert on public.appointments for insert to authenticated
  with check ((select public.current_user_role()) in ('admin', 'receptionist'));
create policy appointments_update on public.appointments for update to authenticated
  using (
    (select public.current_user_role()) in ('admin', 'receptionist')
    or ((select public.current_user_role()) = 'doctor' and doctor_id = (select public.current_doctor_id()))
  )
  with check (
    (select public.current_user_role()) in ('admin', 'receptionist')
    or ((select public.current_user_role()) = 'doctor' and doctor_id = (select public.current_doctor_id()))
  );
create policy appointments_delete_admin on public.appointments for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

-- consultations: admin = read-only; doctor = CRUD on their own appointments; receptionist = no access.
create policy consultations_select on public.consultations for select to authenticated
  using (
    (select public.current_user_role()) = 'admin'
    or ((select public.current_user_role()) = 'doctor' and public.doctor_owns_appointment(appointment_id))
  );
create policy consultations_insert_doctor on public.consultations for insert to authenticated
  with check ((select public.current_user_role()) = 'doctor' and public.doctor_owns_appointment(appointment_id));
create policy consultations_update_doctor on public.consultations for update to authenticated
  using      ((select public.current_user_role()) = 'doctor' and public.doctor_owns_appointment(appointment_id))
  with check ((select public.current_user_role()) = 'doctor' and public.doctor_owns_appointment(appointment_id));
create policy consultations_delete_doctor on public.consultations for delete to authenticated
  using ((select public.current_user_role()) = 'doctor' and public.doctor_owns_appointment(appointment_id));

-- prescriptions: doctor = own (until dispensed); admin/receptionist = read.
create policy prescriptions_select on public.prescriptions for select to authenticated
  using (
    (select public.current_user_role()) in ('admin', 'receptionist')
    or ((select public.current_user_role()) = 'doctor' and public.doctor_owns_consultation(consultation_id))
  );
create policy prescriptions_insert_doctor on public.prescriptions for insert to authenticated
  with check ((select public.current_user_role()) = 'doctor' and public.doctor_owns_consultation(consultation_id));
create policy prescriptions_update_doctor on public.prescriptions for update to authenticated
  using      ((select public.current_user_role()) = 'doctor' and public.doctor_owns_consultation(consultation_id) and dispensed_at is null)
  with check ((select public.current_user_role()) = 'doctor' and public.doctor_owns_consultation(consultation_id));
create policy prescriptions_delete_doctor on public.prescriptions for delete to authenticated
  using ((select public.current_user_role()) = 'doctor' and public.doctor_owns_consultation(consultation_id) and dispensed_at is null);

-- invoices: admin/receptionist CRUD; doctor = read-only, for their own appointments.
create policy invoices_select on public.invoices for select to authenticated
  using (
    (select public.current_user_role()) in ('admin', 'receptionist')
    or ((select public.current_user_role()) = 'doctor' and appointment_id is not null and public.doctor_owns_appointment(appointment_id))
  );
create policy invoices_insert on public.invoices for insert to authenticated
  with check ((select public.current_user_role()) in ('admin', 'receptionist'));
create policy invoices_update on public.invoices for update to authenticated
  using      ((select public.current_user_role()) in ('admin', 'receptionist'))
  with check ((select public.current_user_role()) in ('admin', 'receptionist'));
create policy invoices_delete_admin on public.invoices for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

-- invoice_items and payments: visible only if the invoice is visible (the invoices RLS does the filtering).
create policy invoice_items_select on public.invoice_items for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id));
create policy invoice_items_insert on public.invoice_items for insert to authenticated
  with check ((select public.current_user_role()) in ('admin', 'receptionist'));
create policy invoice_items_update on public.invoice_items for update to authenticated
  using      ((select public.current_user_role()) in ('admin', 'receptionist'))
  with check ((select public.current_user_role()) in ('admin', 'receptionist'));
create policy invoice_items_delete on public.invoice_items for delete to authenticated
  using ((select public.current_user_role()) in ('admin', 'receptionist'));

create policy payments_select on public.payments for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = payments.invoice_id));
create policy payments_insert on public.payments for insert to authenticated
  with check ((select public.current_user_role()) in ('admin', 'receptionist'));

-- audit_logs: only admins can read. NO insert/update/delete policy
-- for anyone in the app; only triggers (SECURITY DEFINER) and service_role can write.
create policy audit_logs_select_admin on public.audit_logs for select to authenticated
  using ((select public.current_user_role()) = 'admin');
