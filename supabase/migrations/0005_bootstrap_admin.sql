-- =====================================================================
-- 0005_bootstrap_admin.sql   (RUN THIS MANUALLY, AFTER 0001-0004)
--
-- Why is this needed? For security, a new user who has no role set by an admin
-- is INACTIVE. So the FIRST admin has to be activated here.
--
-- Steps:
--  1) Supabase Dashboard -> Authentication -> Users -> "Add user" -> "Create new user"
--     (enter an email + a strong password, tick "Auto Confirm User")
--  2) Replace the email below, then Run.
-- =====================================================================

update public.profiles
   set role = 'admin',
       is_active = true,
       full_name = 'System Administrator'
 where id = (select id from auth.users where email = 'REPLACE-ME@example.com')
returning id, full_name, role, is_active;   -- should return exactly 1 row

-- ---------------------------------------------------------------------
-- (Optional) Create a DOCTOR for testing/demo:
--  1) First create the user in the Dashboard (same as above).
--  2) Replace the email and run both statements:
-- ---------------------------------------------------------------------
-- update public.profiles
--    set role = 'doctor', is_active = true, full_name = 'Dr. Ana Reyes'
--  where id = (select id from auth.users where email = 'doctor@example.com');
--
-- insert into public.doctors (profile_id, specialization, license_no)
-- select id, 'General Medicine', 'PRC-0012345'
--   from public.profiles where full_name = 'Dr. Ana Reyes';
--
-- ---------------------------------------------------------------------
-- (Optional) Receptionist:
-- ---------------------------------------------------------------------
-- update public.profiles
--    set role = 'receptionist', is_active = true, full_name = 'Rita Cruz'
--  where id = (select id from auth.users where email = 'reception@example.com');
