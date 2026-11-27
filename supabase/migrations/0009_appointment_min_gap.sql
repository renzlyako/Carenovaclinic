-- =====================================================================
-- 0009_appointment_min_gap.sql
-- RUN THIS ONCE in the Supabase SQL Editor (after 0001-0008).
--
-- Why: 0001 only blocks the EXACT same timestamp for one doctor
-- (appointments_no_double_booking). It does nothing to stop a doctor from
-- being booked, say, at 10:00 and again at 10:01 - which is not realistic,
-- since a consultation actually takes time. This adds a minimum gap
-- (MIN_GAP below) between any two non-cancelled appointments for the
-- same doctor.
--
-- The existing exact-match unique index stays in place and still owns
-- the "same exact time" case, so its error message/behavior is unchanged.
-- This trigger only owns the "too close but not identical" case.
-- =====================================================================

create or replace function public.appointments_check_min_gap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  min_gap    interval := interval '30 minutes'; -- change here if the clinic wants a different buffer
  v_conflict uuid;
begin
  -- A cancelled appointment doesn't occupy the doctor's time.
  if new.status = 'cancelled' then
    return new;
  end if;

  -- Nothing relevant changed (e.g. a doctor just marking it "completed") - skip the check.
  if tg_op = 'UPDATE'
     and new.doctor_id = old.doctor_id
     and new.schedule = old.schedule then
    return new;
  end if;

  select id into v_conflict
  from public.appointments
  where doctor_id = new.doctor_id
    and status <> 'cancelled'
    and id is distinct from new.id
    and schedule <> new.schedule          -- the exact-same-time case is handled by the unique index
    and schedule > (new.schedule - min_gap)
    and schedule < (new.schedule + min_gap)
  limit 1;

  if v_conflict is not null then
    raise exception 'appointments_min_gap: doctor % already has an appointment within % of %', new.doctor_id, min_gap, new.schedule
      using errcode = 'unique_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.appointments_check_min_gap() from public, anon, authenticated;

drop trigger if exists trg_appointments_check_min_gap on public.appointments;
create trigger trg_appointments_check_min_gap
  before insert or update on public.appointments
  for each row execute function public.appointments_check_min_gap();
