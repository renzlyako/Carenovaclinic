update public.profiles
   set role = 'admin',
       is_active = true,
       full_name = 'System Administrator'
 where id = (select id from auth.users where email = 'REPLACE-ME@example.com')
returning id, full_name, role, is_active;   -- should return exactly 1 row

