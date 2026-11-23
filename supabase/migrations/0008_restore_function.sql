create or replace function public.restore_from_backup(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_tables constant text[] := array[
    'patients', 'medicines', 'appointments', 'consultations',
    'prescriptions', 'invoices', 'invoice_items', 'payments'
  ];
  v_t        text;
  v_cols     text;
  v_sel      text;
  v_seq      text;
  v_col      text;
  v_count    bigint;
  v_counts   jsonb := '{}'::jsonb;
  v_total    bigint := 0;
begin
  if jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'Invalid backup: the file has no table data';
  end if;
  foreach v_t in array v_tables loop
    if jsonb_typeof(p_data -> v_t) is distinct from 'array' then
      raise exception 'Invalid backup: table "%" is missing', v_t;
    end if;
    v_total := v_total + jsonb_array_length(p_data -> v_t);
  end loop;
  if v_total > 200000 then
    raise exception 'The backup is too large to restore from the app (% rows)', v_total;
  end if;

  begin

    foreach v_t in array v_tables loop
      execute format('alter table public.%I disable trigger user', v_t);
    end loop;


    for i in reverse array_length(v_tables, 1)..1 loop
      execute format('delete from public.%I where true', v_tables[i]);
    end loop;


    foreach v_t in array v_tables loop

      select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
             string_agg(
               case

                 when c.column_name in ('created_by', 'dispensed_by', 'received_by')
                   then format('case when exists (select 1 from public.profiles pr where pr.id = r.%1$I) then r.%1$I end', c.column_name)
                 else format('r.%I', c.column_name)
               end,
               ', ' order by c.ordinal_position)
        into v_cols, v_sel
        from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = v_t and c.is_generated = 'NEVER';

      execute format(
        'insert into public.%1$I (%2$s) overriding system value '
        'select %3$s from jsonb_populate_recordset(null::public.%1$I, $1) as r',
        v_t, v_cols, v_sel
      ) using (p_data -> v_t);

      get diagnostics v_count = row_count;
      v_counts := v_counts || jsonb_build_object(v_t, v_count);


      for v_col in
        select c.column_name::text
          from information_schema.columns c
         where c.table_schema = 'public' and c.table_name = v_t and c.is_identity = 'YES'
      loop
        v_seq := pg_get_serial_sequence(format('public.%I', v_t), v_col);
        if v_seq is not null then
          execute format(
            'select setval(%L, coalesce((select max(%I) from public.%I), 0) + 1, false)',
            v_seq, v_col, v_t
          );
        end if;
      end loop;
    end loop;


    foreach v_t in array v_tables loop
      execute format('alter table public.%I enable trigger user', v_t);
    end loop;
  exception
    when foreign_key_violation then
      raise exception 'The backup refers to a record that does not exist in this database (for example a doctor). Restore it only into the project it was created from.';
    when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
      raise exception 'The backup contains a value with an invalid format.';
  end;

  return jsonb_build_object('restored', v_counts);
end;
$$;

revoke all on function public.restore_from_backup(jsonb) from public, anon, authenticated;
grant execute on function public.restore_from_backup(jsonb) to service_role;
