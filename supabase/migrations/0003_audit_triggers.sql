-- =====================================================================
-- 0003_audit_triggers.sql
-- Audit trail: INSERT / UPDATE / DELETE are recorded automatically,
-- and audit_logs can never be modified or deleted.
-- =====================================================================

-- ---------- Generic audit trigger ----------
-- Records: who (auth.uid + email), what action, which table/record, old and new data, and when.
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
      return null;  -- nothing actually changed
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

  return null;  -- AFTER trigger, the return value is ignored
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

-- ---------- audit_logs protection (append-only) ----------
-- Layer 1: RLS  -> no insert/update/delete policy for app users (see 0002)
-- Layer 2: GRANT -> no UPDATE/DELETE privilege, not even for service_role (see 0002)
-- Layer 3: TRIGGER (this one) -> raises an error no matter who tries, even the owner.
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
