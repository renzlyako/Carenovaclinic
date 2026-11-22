-- =====================================================================
-- dev_reset.sql   ⚠️ DELETES ALL DATA AND TABLES OF THE PROJECT (dev only!)
-- Use this if you want to re-run 0001-0008 from scratch.
-- It does not touch auth.users (your accounts).
-- =====================================================================
drop trigger if exists on_auth_user_created on auth.users;

drop view if exists
  public.v_dashboard_kpis, public.v_appointments_per_day, public.v_revenue_monthly,
  public.v_appointment_status_counts, public.v_top_diagnoses, public.v_low_stock_medicines,
  public.v_daily_collection, public.v_patients_per_doctor;

drop table if exists
  public.audit_logs, public.payments, public.invoice_items, public.invoices,
  public.prescriptions, public.consultations, public.appointments,
  public.medicines, public.patients, public.doctors, public.profiles cascade;

drop function if exists public.dispense_prescription(uuid, uuid);
drop function if exists public.void_invoice(uuid);
drop function if exists public.handle_new_user();
drop function if exists public.protect_last_admin();
drop function if exists public.doctors_check_profile_role();
drop function if exists public.prescriptions_guard();
drop function if exists public.invoice_items_guard();
drop function if exists public.invoice_items_recalc();
drop function if exists public.payments_guard();
drop function if exists public.payments_apply();
drop function if exists public.payments_block_modify();
drop function if exists public.compute_invoice_status(numeric, numeric);
drop function if exists public.audit_trigger_fn();
drop function if exists public.audit_logs_block_modify();
drop function if exists public.current_user_role();
drop function if exists public.current_doctor_id();
drop function if exists public.doctor_owns_appointment(uuid);
drop function if exists public.doctor_owns_consultation(uuid);
drop function if exists public.doctor_has_patient(uuid);
drop function if exists public.appointments_doctor_guard();
drop function if exists public.pending_prescriptions(uuid);
drop function if exists public.restore_from_backup(jsonb);
drop function if exists public.set_updated_at();

drop type if exists public.user_role, public.sex_type, public.appointment_status,
  public.invoice_status, public.payment_method;
