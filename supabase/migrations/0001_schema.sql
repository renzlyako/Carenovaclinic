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
