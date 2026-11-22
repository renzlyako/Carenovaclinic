-- =====================================================================
-- 0007_pending_prescriptions.sql
-- RUN THIS ONCE in the Supabase SQL Editor (after 0001-0006).
--
-- Why: the front desk must see which prescriptions of a patient are still waiting to
-- be dispensed, but receptionists are (correctly) NOT allowed to read consultations
-- (diagnosis and clinical notes are private to doctors and admins).
-- This function returns ONLY the medicine information (no diagnosis, no notes),
-- and only to admin / receptionist.
-- =====================================================================

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
