-- ---------- ENUMS ----------
create type public.user_role          as enum ('admin', 'doctor', 'receptionist');
create type public.sex_type           as enum ('male', 'female', 'other');
create type public.appointment_status as enum ('scheduled', 'completed', 'cancelled', 'no_show');
create type public.invoice_status     as enum ('unpaid', 'partial', 'paid', 'void');
create type public.payment_method     as enum ('cash', 'gcash', 'card', 'bank_transfer');

-- ---------- COMMON TRIGGER: updated_at ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- PROFILES (1:1 with auth.users) ----------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (length(btrim(full_name)) > 0),
  role        public.user_role not null default 'receptionist',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- DOCTORS ----------
create table public.doctors (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null unique references public.profiles (id) on delete restrict,
  specialization text not null check (length(btrim(specialization)) > 0),
  license_no     text not null unique check (length(btrim(license_no)) > 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------- PATIENTS ----------
create table public.patients (
  id                      uuid primary key default gen_random_uuid(),
  patient_seq             bigint generated always as identity,
  patient_no              text generated always as ('P-' || lpad(patient_seq::text, 5, '0')) stored unique,
  first_name              text not null check (length(btrim(first_name)) > 0),
  last_name               text not null check (length(btrim(last_name)) > 0),
  birthdate               date not null check (birthdate >= date '1900-01-01' and birthdate <= current_date),
  sex                     public.sex_type not null,
  contact_no              text not null check (contact_no ~ '^[0-9+ -]{7,15}$'),
  address                 text,
  emergency_contact_name  text,
  emergency_contact_no    text check (emergency_contact_no is null or emergency_contact_no ~ '^[0-9+ -]{7,15}$'),
  created_by              uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ---------- MEDICINES ----------
create table public.medicines (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique check (length(btrim(name)) > 0),
  description    text,
  stock_qty      integer not null default 0 check (stock_qty >= 0),
  reorder_level  integer not null default 10 check (reorder_level >= 0),
  unit_price     numeric(10,2) not null check (unit_price >= 0),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------- APPOINTMENTS ----------
create table public.appointments (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients (id) on delete restrict,
  doctor_id   uuid not null references public.doctors (id)  on delete restrict,
  schedule    timestamptz not null,
  status      public.appointment_status not null default 'scheduled',
  reason      text,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);


create unique index appointments_no_double_booking
  on public.appointments (doctor_id, schedule)
  where status <> 'cancelled';

-- ---------- CONSULTATIONS ----------
create table public.consultations (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null unique references public.appointments (id) on delete restrict,
  diagnosis       text not null check (length(btrim(diagnosis)) > 0),
  notes           text,
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------- PRESCRIPTIONS ----------
create table public.prescriptions (
  id               uuid primary key default gen_random_uuid(),
  consultation_id  uuid not null references public.consultations (id) on delete restrict,
  medicine_id      uuid not null references public.medicines (id) on delete restrict,
  dosage           text not null check (length(btrim(dosage)) > 0),
  qty              integer not null check (qty > 0),
  dispensed_at     timestamptz,
  dispensed_by     uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------- INVOICES ----------
create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  invoice_seq     bigint generated always as identity,
  invoice_no      text generated always as ('INV-' || lpad(invoice_seq::text, 6, '0')) stored unique,
  patient_id      uuid not null references public.patients (id) on delete restrict,
  appointment_id  uuid references public.appointments (id) on delete restrict,
  total           numeric(12,2) not null default 0 check (total >= 0),
  amount_paid     numeric(12,2) not null default 0 check (amount_paid >= 0),
  status          public.invoice_status not null default 'unpaid',
  notes           text,
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint invoices_paid_not_over_total check (amount_paid <= total)
);

-- ---------- INVOICE ITEMS ----------
create table public.invoice_items (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.invoices (id) on delete cascade,
  description  text not null check (length(btrim(description)) > 0),
  medicine_id  uuid references public.medicines (id) on delete restrict,
  qty          integer not null check (qty > 0),
  unit_price   numeric(10,2) not null check (unit_price >= 0),
  line_total   numeric(12,2) generated always as (qty * unit_price) stored,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------- PAYMENTS ----------
create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references public.invoices (id) on delete restrict,
  amount        numeric(12,2) not null check (amount > 0),
  method        public.payment_method not null,
  reference_no  text,
  paid_at       timestamptz not null default now(),
  received_by   uuid default auth.uid() references public.profiles (id) on delete set null
);

-- ---------- AUDIT LOGS (append-only; see 0003) ----------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  user_id     uuid,
  user_email  text,
  action      text not null,
  table_name  text,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  details     jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- INDEXES ----------
create index patients_name_idx            on public.patients (last_name, first_name);
create index appointments_patient_idx     on public.appointments (patient_id);
create index appointments_schedule_idx    on public.appointments (schedule);
create index prescriptions_consult_idx    on public.prescriptions (consultation_id);
create index prescriptions_medicine_idx   on public.prescriptions (medicine_id);
create index invoices_patient_idx         on public.invoices (patient_id);
create index invoices_appointment_idx     on public.invoices (appointment_id);
create index invoice_items_invoice_idx    on public.invoice_items (invoice_id);
create index payments_invoice_idx         on public.payments (invoice_id);
create index payments_paid_at_idx         on public.payments (paid_at);
create index audit_logs_created_idx       on public.audit_logs (created_at desc);
create index audit_logs_user_idx          on public.audit_logs (user_id);
create index audit_logs_action_idx        on public.audit_logs (action);
create index audit_logs_record_idx        on public.audit_logs (table_name, record_id);

-- ---------- updated_at TRIGGERS ----------
create trigger trg_profiles_updated      before update on public.profiles      for each row execute function public.set_updated_at();
create trigger trg_doctors_updated       before update on public.doctors       for each row execute function public.set_updated_at();
create trigger trg_patients_updated      before update on public.patients      for each row execute function public.set_updated_at();
create trigger trg_medicines_updated     before update on public.medicines     for each row execute function public.set_updated_at();
create trigger trg_appointments_updated  before update on public.appointments  for each row execute function public.set_updated_at();
create trigger trg_consultations_updated before update on public.consultations for each row execute function public.set_updated_at();
create trigger trg_prescriptions_updated before update on public.prescriptions for each row execute function public.set_updated_at();
create trigger trg_invoices_updated      before update on public.invoices      for each row execute function public.set_updated_at();
create trigger trg_invoice_items_updated before update on public.invoice_items for each row execute function public.set_updated_at();


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
grant usage on schema public to anon, authenticated, service_role;

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

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

grant insert (consultation_id, medicine_id, dosage, qty) on public.prescriptions to authenticated;
grant update (medicine_id, dosage, qty)                  on public.prescriptions to authenticated;
grant delete                                             on public.prescriptions to authenticated;

grant insert (patient_id, appointment_id, notes) on public.invoices to authenticated;
grant update (notes)                             on public.invoices to authenticated;
grant delete                                     on public.invoices to authenticated;

grant insert (invoice_id, description, qty, unit_price) on public.invoice_items to authenticated;
grant update (description, qty, unit_price)             on public.invoice_items to authenticated;
grant delete                                            on public.invoice_items to authenticated;

grant insert (invoice_id, amount, method, reference_no) on public.payments to authenticated;

grant select, insert, update, delete on all tables in schema public to service_role;

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

create policy medicines_select on public.medicines for select to authenticated
  using ((select public.current_user_role()) is not null);
create policy medicines_insert_admin on public.medicines for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');
create policy medicines_update_admin on public.medicines for update to authenticated
  using      ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');
create policy medicines_delete_admin on public.medicines for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

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


create policy audit_logs_select_admin on public.audit_logs for select to authenticated
  using ((select public.current_user_role()) = 'admin');

create or replace function public.audit_trigger_fn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid := auth.uid();
  v_email      text;
  v_old        jsonb;
  v_new        jsonb;
  v_record_id  text;
begin
  if v_user is not null then
    select u.email into v_email from auth.users u where u.id = v_user;
  end if;

  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_record_id := v_new ->> 'id';
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    if v_old = v_new then
      return null;  
    end if;
    v_record_id := v_new ->> 'id';
  else
    v_old := to_jsonb(old);
    v_record_id := v_old ->> 'id';
  end if;

  insert into public.audit_logs (user_id, user_email, action, table_name, record_id, old_data, new_data, details)
  values (
    v_user, v_email, tg_op, tg_table_name, v_record_id, v_old, v_new,
    jsonb_build_object('db_user', current_user)
  );

  return null;  
end;
$$;

revoke all on function public.audit_trigger_fn() from public, anon, authenticated;

-- ---------- Attach to all business tables ----------
create trigger audit_profiles      after insert or update or delete on public.profiles      for each row execute function public.audit_trigger_fn();
create trigger audit_doctors       after insert or update or delete on public.doctors       for each row execute function public.audit_trigger_fn();
create trigger audit_patients      after insert or update or delete on public.patients      for each row execute function public.audit_trigger_fn();
create trigger audit_medicines     after insert or update or delete on public.medicines     for each row execute function public.audit_trigger_fn();
create trigger audit_appointments  after insert or update or delete on public.appointments  for each row execute function public.audit_trigger_fn();
create trigger audit_consultations after insert or update or delete on public.consultations for each row execute function public.audit_trigger_fn();
create trigger audit_prescriptions after insert or update or delete on public.prescriptions for each row execute function public.audit_trigger_fn();
create trigger audit_invoices      after insert or update or delete on public.invoices      for each row execute function public.audit_trigger_fn();
create trigger audit_invoice_items after insert or update or delete on public.invoice_items for each row execute function public.audit_trigger_fn();
create trigger audit_payments      after insert or update or delete on public.payments      for each row execute function public.audit_trigger_fn();


create or replace function public.audit_logs_block_modify()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only: % is not allowed', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

revoke all on function public.audit_logs_block_modify() from public, anon, authenticated;

create trigger audit_logs_no_update_delete
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_block_modify();

create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function public.audit_logs_block_modify();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role    public.user_role := 'receptionist';
  v_active  boolean := false;
  v_meta    text := new.raw_app_meta_data ->> 'role';
begin
  if v_meta in ('admin', 'doctor', 'receptionist') then
    v_role := v_meta::public.user_role;
    v_active := true;
  end if;

  insert into public.profiles (id, full_name, role, is_active)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'user'), '@', 1)),
    v_role,
    v_active
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: users created before the trigger existed (inactive until an admin approves them).
insert into public.profiles (id, full_name, role, is_active)
select u.id,
       coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(u.email, 'user'), '@', 1)),
       'receptionist', false
from auth.users u
on conflict (id) do nothing;

-- ---------- Integrity: never end up without an active admin ----------
create or replace function public.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.is_active
     and (tg_op = 'DELETE' or new.role <> 'admin' or not new.is_active) then
    if not exists (
      select 1 from public.profiles p
      where p.role = 'admin' and p.is_active and p.id <> old.id
    ) then
      raise exception 'Cannot remove, demote or deactivate the last active admin';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.protect_last_admin() from public, anon, authenticated;

create trigger trg_profiles_protect_last_admin
  before update or delete on public.profiles
  for each row execute function public.protect_last_admin();

-- ---------- Integrity: a doctor record must be linked to a profile with role = doctor ----------
create or replace function public.doctors_check_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = new.profile_id and p.role = 'doctor') then
    raise exception 'Profile % must have role = doctor', new.profile_id;
  end if;
  return new;
end;
$$;
revoke all on function public.doctors_check_profile_role() from public, anon, authenticated;

create trigger trg_doctors_check_profile_role
  before insert or update of profile_id on public.doctors
  for each row execute function public.doctors_check_profile_role();

-- ---------- Integrity: dispensed prescriptions are locked ----------
create or replace function public.prescriptions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.dispensed_at is not null then
    raise exception 'A dispensed prescription cannot be modified or deleted';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.prescriptions_guard() from public, anon, authenticated;

create trigger trg_prescriptions_guard
  before update or delete on public.prescriptions
  for each row execute function public.prescriptions_guard();

-- ---------- Billing: status helper ----------
create or replace function public.compute_invoice_status(p_total numeric, p_paid numeric)
returns public.invoice_status
language sql immutable
set search_path = ''
as $$
  select (case
    when p_paid <= 0       then 'unpaid'
    when p_paid >= p_total then 'paid'
    else 'partial'
  end)::public.invoice_status
$$;

-- ---------- Billing: invoice_items -> auto-recalculate invoice total ----------
create or replace function public.invoice_items_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice  uuid := coalesce(new.invoice_id, old.invoice_id);
  v_status   public.invoice_status;
begin
  if tg_op = 'UPDATE' and new.invoice_id <> old.invoice_id then
    raise exception 'invoice_id of an item cannot be changed';
  end if;

  select i.status into v_status from public.invoices i where i.id = v_invoice for update;
  if v_status in ('paid', 'void') then
    raise exception 'Cannot modify items of a % invoice', v_status;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.invoice_items_guard() from public, anon, authenticated;

create or replace function public.invoice_items_recalc()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice  uuid := coalesce(new.invoice_id, old.invoice_id);
  v_total    numeric(12,2);
begin
  select coalesce(sum(ii.line_total), 0) into v_total
  from public.invoice_items ii where ii.invoice_id = v_invoice;

  update public.invoices i
     set total  = v_total,
         status = public.compute_invoice_status(v_total, i.amount_paid)
   where i.id = v_invoice;

  return null;
end;
$$;
revoke all on function public.invoice_items_recalc() from public, anon, authenticated;

create trigger trg_invoice_items_guard
  before insert or update or delete on public.invoice_items
  for each row execute function public.invoice_items_guard();
create trigger trg_invoice_items_recalc
  after insert or update or delete on public.invoice_items
  for each row execute function public.invoice_items_recalc();

-- ---------- Billing: payments ----------
create or replace function public.payments_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invoices%rowtype;
begin
  select * into v_inv from public.invoices i where i.id = new.invoice_id for update;
  if not found then
    raise exception 'Invoice not found';
  end if;
  if v_inv.status = 'void' then
    raise exception 'Cannot pay a void invoice';
  end if;
  if v_inv.status = 'paid' then
    raise exception 'Invoice % is already fully paid', v_inv.invoice_no;
  end if;
  if new.amount > v_inv.total - v_inv.amount_paid then
    raise exception 'Payment of % exceeds the remaining balance of %', new.amount, (v_inv.total - v_inv.amount_paid);
  end if;
  return new;
end;
$$;
revoke all on function public.payments_guard() from public, anon, authenticated;

create or replace function public.payments_apply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.invoices i
     set amount_paid = i.amount_paid + new.amount,
         status      = public.compute_invoice_status(i.total, i.amount_paid + new.amount)
   where i.id = new.invoice_id;
  return null;
end;
$$;
revoke all on function public.payments_apply() from public, anon, authenticated;

create or replace function public.payments_block_modify()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Payments are permanent records and cannot be modified or deleted';
end;
$$;
revoke all on function public.payments_block_modify() from public, anon, authenticated;

create trigger trg_payments_guard
  before insert on public.payments
  for each row execute function public.payments_guard();
create trigger trg_payments_apply
  after insert on public.payments
  for each row execute function public.payments_apply();
create trigger trg_payments_block_modify
  before update or delete on public.payments
  for each row execute function public.payments_block_modify();


create or replace function public.dispense_prescription(p_prescription_id uuid, p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role     public.user_role := public.current_user_role();
  v_rx       public.prescriptions%rowtype;
  v_med      public.medicines%rowtype;
  v_inv      public.invoices%rowtype;
  v_patient  uuid;
  v_item     uuid;
begin
  if v_role is null or v_role not in ('admin', 'receptionist') then
    raise exception 'Not authorized to dispense medicines' using errcode = 'insufficient_privilege';
  end if;

  select * into v_rx from public.prescriptions p where p.id = p_prescription_id for update;
  if not found then raise exception 'Prescription not found'; end if;
  if v_rx.dispensed_at is not null then raise exception 'Prescription was already dispensed'; end if;

  select a.patient_id into v_patient
  from public.consultations c
  join public.appointments a on a.id = c.appointment_id
  where c.id = v_rx.consultation_id;

  select * into v_inv from public.invoices i where i.id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_inv.status in ('paid', 'void') then raise exception 'Cannot add items to a % invoice', v_inv.status; end if;
  if v_inv.patient_id <> v_patient then raise exception 'Invoice belongs to a different patient'; end if;

  select * into v_med from public.medicines m where m.id = v_rx.medicine_id for update;
  if not v_med.is_active then raise exception 'Medicine % is inactive', v_med.name; end if;
  if v_med.stock_qty < v_rx.qty then
    raise exception 'Insufficient stock for %: available %, needed %', v_med.name, v_med.stock_qty, v_rx.qty;
  end if;

  update public.medicines set stock_qty = stock_qty - v_rx.qty where id = v_med.id;

  insert into public.invoice_items (invoice_id, description, medicine_id, qty, unit_price)
  values (p_invoice_id, 'Medicine: ' || v_med.name || ' (' || v_rx.dosage || ')', v_med.id, v_rx.qty, v_med.unit_price)
  returning id into v_item;

  update public.prescriptions
     set dispensed_at = now(), dispensed_by = auth.uid()
   where id = v_rx.id;

  return v_item;
end;
$$;

create or replace function public.void_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invoices%rowtype;
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'Only an admin can void an invoice' using errcode = 'insufficient_privilege';
  end if;

  select * into v_inv from public.invoices i where i.id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_inv.status = 'void' then raise exception 'Invoice is already void'; end if;
  if v_inv.amount_paid > 0 then raise exception 'Cannot void an invoice that already has payments'; end if;

  update public.invoices set status = 'void' where id = p_invoice_id;
end;
$$;

revoke all on function public.dispense_prescription(uuid, uuid) from public, anon;
revoke all on function public.void_invoice(uuid)                from public, anon;
grant execute on function public.dispense_prescription(uuid, uuid) to authenticated;
grant execute on function public.void_invoice(uuid)                to authenticated;


create view public.v_dashboard_kpis with (security_invoker = true) as
select
  (select count(*) from public.appointments a
    where (a.schedule at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
      and a.status <> 'cancelled')::int                                         as appointments_today,
  (select count(*) from public.patients)::int                                   as total_patients,
  (select coalesce(sum(p.amount), 0) from public.payments p
    where date_trunc('month', p.paid_at at time zone 'Asia/Manila')
        = date_trunc('month', now() at time zone 'Asia/Manila'))                as revenue_this_month,
  (select count(*) from public.invoices i where i.status in ('unpaid', 'partial'))::int as unpaid_invoices,
  (select count(*) from public.medicines m
    where m.is_active and m.stock_qty <= m.reorder_level)::int                  as low_stock_medicines;

create view public.v_appointments_per_day with (security_invoker = true) as
select (a.schedule at time zone 'Asia/Manila')::date as day, count(*)::int as total
from public.appointments a
where a.status <> 'cancelled'
  and a.schedule >= now() - interval '7 days'
  and a.schedule <  now() + interval '8 days'
group by 1
order by 1;

create view public.v_revenue_monthly with (security_invoker = true) as
select to_char(date_trunc('month', p.paid_at at time zone 'Asia/Manila'), 'YYYY-MM') as month,
       sum(p.amount) as revenue
from public.payments p
where p.paid_at >= date_trunc('month', now()) - interval '11 months'
group by 1
order by 1;

create view public.v_appointment_status_counts with (security_invoker = true) as
select a.status::text as status, count(*)::int as total
from public.appointments a
group by 1
order by 1;

create view public.v_top_diagnoses with (security_invoker = true) as
select lower(btrim(c.diagnosis)) as diagnosis, count(*)::int as total
from public.consultations c
group by 1
order by total desc, diagnosis
limit 10;

create view public.v_low_stock_medicines with (security_invoker = true) as
select m.id, m.name, m.stock_qty, m.reorder_level
from public.medicines m
where m.is_active and m.stock_qty <= m.reorder_level
order by m.stock_qty, m.name;

create view public.v_daily_collection with (security_invoker = true) as
select (p.paid_at at time zone 'Asia/Manila')::date as day,
       p.method::text as method,
       count(*)::int as payments,
       sum(p.amount) as total
from public.payments p
group by 1, 2
order by 1 desc, 2;

create view public.v_patients_per_doctor with (security_invoker = true) as
select d.id as doctor_id,
       pr.full_name as doctor_name,
       count(distinct a.patient_id)::int as patients,
       count(a.id)::int as appointments
from public.doctors d
join public.profiles pr on pr.id = d.profile_id
left join public.appointments a on a.doctor_id = d.id and a.status <> 'cancelled'
group by d.id, pr.full_name
order by pr.full_name;

revoke all on
  public.v_dashboard_kpis, public.v_appointments_per_day, public.v_revenue_monthly,
  public.v_appointment_status_counts, public.v_top_diagnoses, public.v_low_stock_medicines,
  public.v_daily_collection, public.v_patients_per_doctor
from public, anon;

grant select on
  public.v_dashboard_kpis, public.v_appointments_per_day, public.v_revenue_monthly,
  public.v_appointment_status_counts, public.v_top_diagnoses, public.v_low_stock_medicines,
  public.v_daily_collection, public.v_patients_per_doctor
to authenticated, service_role;


create or replace function public.appointments_doctor_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() = 'doctor' then
    if new.patient_id is distinct from old.patient_id
       or new.doctor_id is distinct from old.doctor_id
       or new.schedule  is distinct from old.schedule
       or new.reason    is distinct from old.reason then
      raise exception 'Doctors can only change the status of an appointment'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.appointments_doctor_guard() from public, anon, authenticated;

create trigger trg_appointments_doctor_guard
  before update on public.appointments
  for each row execute function public.appointments_doctor_guard();


create or replace function public.pending_prescriptions(p_patient_id uuid)
returns table (
  prescription_id uuid,
  medicine_id     uuid,
  medicine_name   text,
  dosage          text,
  qty             integer,
  stock_qty       integer,
  unit_price      numeric,
  is_active       boolean,
  prescribed_at   timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, m.id, m.name, p.dosage, p.qty, m.stock_qty, m.unit_price, m.is_active, p.created_at
  from public.prescriptions p
  join public.consultations c on c.id = p.consultation_id
  join public.appointments  a on a.id = c.appointment_id
  join public.medicines     m on m.id = p.medicine_id
  where a.patient_id = p_patient_id
    and p.dispensed_at is null
    and public.current_user_role() in ('admin', 'receptionist')
  order by p.created_at
$$;

revoke all on function public.pending_prescriptions(uuid) from public, anon;
grant execute on function public.pending_prescriptions(uuid) to authenticated;


create or replace function public.restore_from_backup(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_tables constant text[] := array[
    'patients', 'medicines', 'appointments', 'consultations',
    'prescriptions', 'invoices', 'invoice_items', 'payments'
  ];
  v_t        text;
  v_cols     text;
  v_sel      text;
  v_seq      text;
  v_col      text;
  v_count    bigint;
  v_counts   jsonb := '{}'::jsonb;
  v_total    bigint := 0;
begin
  if jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'Invalid backup: the file has no table data';
  end if;
  foreach v_t in array v_tables loop
    if jsonb_typeof(p_data -> v_t) is distinct from 'array' then
      raise exception 'Invalid backup: table "%" is missing', v_t;
    end if;
    v_total := v_total + jsonb_array_length(p_data -> v_t);
  end loop;
  if v_total > 200000 then
    raise exception 'The backup is too large to restore from the app (% rows)', v_total;
  end if;

  begin

    foreach v_t in array v_tables loop
      execute format('alter table public.%I disable trigger user', v_t);
    end loop;


    for i in reverse array_length(v_tables, 1)..1 loop
      execute format('delete from public.%I where true', v_tables[i]);
    end loop;


    foreach v_t in array v_tables loop

      select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
             string_agg(
               case

                 when c.column_name in ('created_by', 'dispensed_by', 'received_by')
                   then format('case when exists (select 1 from public.profiles pr where pr.id = r.%1$I) then r.%1$I end', c.column_name)
                 else format('r.%I', c.column_name)
               end,
               ', ' order by c.ordinal_position)
        into v_cols, v_sel
        from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = v_t and c.is_generated = 'NEVER';

      execute format(
        'insert into public.%1$I (%2$s) overriding system value '
        'select %3$s from jsonb_populate_recordset(null::public.%1$I, $1) as r',
        v_t, v_cols, v_sel
      ) using (p_data -> v_t);

      get diagnostics v_count = row_count;
      v_counts := v_counts || jsonb_build_object(v_t, v_count);


      for v_col in
        select c.column_name::text
          from information_schema.columns c
         where c.table_schema = 'public' and c.table_name = v_t and c.is_identity = 'YES'
      loop
        v_seq := pg_get_serial_sequence(format('public.%I', v_t), v_col);
        if v_seq is not null then
          execute format(
            'select setval(%L, coalesce((select max(%I) from public.%I), 0) + 1, false)',
            v_seq, v_col, v_t
          );
        end if;
      end loop;
    end loop;


    foreach v_t in array v_tables loop
      execute format('alter table public.%I enable trigger user', v_t);
    end loop;
  exception
    when foreign_key_violation then
      raise exception 'The backup refers to a record that does not exist in this database (for example a doctor). Restore it only into the project it was created from.';
    when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
      raise exception 'The backup contains a value with an invalid format.';
  end;

  return jsonb_build_object('restored', v_counts);
end;
$$;

revoke all on function public.restore_from_backup(jsonb) from public, anon, authenticated;
grant execute on function public.restore_from_backup(jsonb) to service_role;
