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
