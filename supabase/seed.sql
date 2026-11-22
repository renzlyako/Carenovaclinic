-- =====================================================================
-- seed.sql   (sample data for the demo; run AFTER 0001-0005)
-- Part 1 can be re-run (medicines will not be duplicated);
-- but Part 1 patients are added again on every run, so run it only once.
-- =====================================================================

-- ---------- PART 1: patients and medicines (no users needed) ----------
insert into public.patients (first_name, last_name, birthdate, sex, contact_no, address) values
  ('Maria',   'Santos',     date '1990-03-14', 'female', '09171234501', 'Quezon City'),
  ('Juan',    'Dela Cruz',  date '1985-07-02', 'male',   '09171234502', 'Manila'),
  ('Angelica','Reyes',      date '2001-11-23', 'female', '09171234503', 'Makati City'),
  ('Mark',    'Villanueva', date '1978-01-30', 'male',   '09171234504', 'Pasig City'),
  ('Liza',    'Garcia',     date '1995-09-09', 'female', '09171234505', 'Taguig City'),
  ('Paolo',   'Mendoza',    date '2015-05-18', 'male',   '09171234506', 'Caloocan City'),
  ('Rosa',    'Bautista',   date '1962-12-05', 'female', '09171234507', 'Mandaluyong'),
  ('Carlo',   'Ramos',      date '1999-06-27', 'male',   '09171234508', 'Marikina City');

insert into public.medicines (name, description, stock_qty, reorder_level, unit_price) values
  ('Paracetamol 500mg',     'Pain reliever / fever',       200, 30,  2.50),
  ('Amoxicillin 500mg',     'Antibiotic',                  120, 20,  8.00),
  ('Cetirizine 10mg',       'Antihistamine',                90, 20,  5.00),
  ('Losartan 50mg',         'Antihypertensive',             80, 20, 10.00),
  ('Metformin 500mg',       'Antidiabetic',                 60, 20,  6.50),
  ('Amlodipine 5mg',        'Antihypertensive',              8, 15,  9.00),   -- low stock (for the demo)
  ('Ibuprofen 400mg',       'Pain reliever / anti-inflammatory', 150, 30, 4.00),
  ('Oral Rehydration Salts','Rehydration',                  40, 15, 12.00)
on conflict (name) do nothing;

-- ---------- PART 2: appointments, consultations, billing ----------
-- Runs ONLY if at least one doctor exists (see 0005_bootstrap_admin.sql).
do $$
declare
  v_doc   uuid;
  v_p     uuid[];
  v_a1    uuid; v_a2 uuid;
  v_c1    uuid; v_c2 uuid;
  v_i1    uuid; v_i2 uuid;
  v_med   uuid;
begin
  select id into v_doc from public.doctors order by created_at limit 1;
  if v_doc is null then
    raise notice 'No doctor yet: skipped Part 2 (appointments/billing).';
    return;
  end if;

  select array_agg(id order by patient_seq) into v_p from (select id, patient_seq from public.patients order by patient_seq limit 6) s;

  -- past appointments (completed) + one cancelled
  insert into public.appointments (patient_id, doctor_id, schedule, status, reason)
  values (v_p[1], v_doc, date_trunc('hour', now()) - interval '1 day',  'completed', 'Cough and fever') returning id into v_a1;
  insert into public.appointments (patient_id, doctor_id, schedule, status, reason)
  values (v_p[2], v_doc, date_trunc('hour', now()) - interval '2 days', 'completed', 'High blood pressure check') returning id into v_a2;
  insert into public.appointments (patient_id, doctor_id, schedule, status, reason)
  values (v_p[3], v_doc, date_trunc('hour', now()) - interval '3 days', 'cancelled', 'Follow-up');

  -- upcoming ones
  insert into public.appointments (patient_id, doctor_id, schedule, status, reason) values
    (v_p[4], v_doc, date_trunc('hour', now()) + interval '1 hour',  'scheduled', 'Stomach ache'),
    (v_p[5], v_doc, date_trunc('hour', now()) + interval '1 day',   'scheduled', 'Regular check-up'),
    (v_p[6], v_doc, date_trunc('hour', now()) + interval '2 days',  'scheduled', 'Vaccination');

  -- consultations + prescription
  insert into public.consultations (appointment_id, diagnosis, notes)
  values (v_a1, 'Acute upper respiratory infection', 'Rest and drink plenty of fluids.') returning id into v_c1;
  insert into public.consultations (appointment_id, diagnosis, notes)
  values (v_a2, 'Hypertension', 'Continue the maintenance medication, return after 1 month.') returning id into v_c2;

  select id into v_med from public.medicines where name = 'Paracetamol 500mg';
  insert into public.prescriptions (consultation_id, medicine_id, dosage, qty)
  values (v_c1, v_med, '1 tablet every 6 hours', 10);

  -- invoices + items + payments (totals/status are updated by triggers)
  insert into public.invoices (patient_id, appointment_id, notes) values (v_p[1], v_a1, 'Consultation') returning id into v_i1;
  insert into public.invoice_items (invoice_id, description, qty, unit_price) values (v_i1, 'Consultation fee', 1, 500);
  insert into public.payments (invoice_id, amount, method) values (v_i1, 500, 'cash');

  insert into public.invoices (patient_id, appointment_id, notes) values (v_p[2], v_a2, 'Consultation') returning id into v_i2;
  insert into public.invoice_items (invoice_id, description, qty, unit_price) values (v_i2, 'Consultation fee', 1, 500);
  insert into public.payments (invoice_id, amount, method) values (v_i2, 200, 'gcash');   -- partial

  raise notice 'Seed Part 2 done.';
end;
$$;
