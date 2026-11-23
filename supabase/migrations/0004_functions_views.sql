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


insert into public.profiles (id, full_name, role, is_active)
select u.id,
       coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(u.email, 'user'), '@', 1)),
       'receptionist', false
from auth.users u
on conflict (id) do nothing;


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
