-- Historical records are kept apart from operational sales and stock until
-- costs and the physical count have been reconciled. Apply once after Module 05.
create table public.historical_records (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  source_key text not null check (length(source_key) between 1 and 120),
  source_fingerprint text not null check (length(source_fingerprint) = 32),
  kind text not null check (kind in ('sale', 'purchase', 'expense', 'count')),
  business_date date not null,
  description text not null check (length(pg_catalog.btrim(description)) between 1 and 300),
  quantity integer check (quantity is null or quantity >= 0),
  amount numeric(14,2) check (amount is null or amount > 0),
  record_status text not null check (length(record_status) between 1 and 80),
  details jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(details) = 'object'),
  imported_at timestamptz not null default pg_catalog.now(),
  unique (owner_id, source_key),
  check (
    (kind = 'sale' and quantity > 0 and amount is not null) or
    (kind = 'purchase' and amount is not null) or
    (kind = 'expense' and quantity is null and amount is not null) or
    (kind = 'count' and quantity is not null and amount is null)
  )
);
create index historical_records_owner_date on public.historical_records(owner_id, business_date desc, kind);
alter table public.historical_records enable row level security;
create policy historical_records_select_own on public.historical_records
  for select to authenticated using ((select auth.uid()) = owner_id);
revoke all on public.historical_records from public, anon, authenticated;
grant select on public.historical_records to authenticated;

create function private.import_historical_records_impl(p_records jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_record jsonb;
  v_key text;
  v_kind text;
  v_date date;
  v_description text;
  v_quantity integer;
  v_amount numeric;
  v_status text;
  v_details jsonb;
  v_fingerprint text;
  v_existing text;
  v_inserted integer := 0;
  v_skipped integer := 0;
begin
  if v_owner is null then raise exception 'Autenticación requerida' using errcode = '42501'; end if;
  if p_records is null or pg_catalog.jsonb_typeof(p_records) <> 'array' or
    pg_catalog.jsonb_array_length(p_records) not between 1 and 100 then
    raise exception 'Enviá entre 1 y 100 registros históricos' using errcode = '22023';
  end if;
  for v_record in select value from pg_catalog.jsonb_array_elements(p_records) as entries(value)
  loop
    if pg_catalog.jsonb_typeof(v_record) <> 'object' then
      raise exception 'Registro histórico inválido' using errcode = '22023';
    end if;
    v_key := v_record->>'source_key';
    v_kind := v_record->>'kind';
    v_description := pg_catalog.btrim(v_record->>'description');
    v_status := v_record->>'record_status';
    v_details := v_record->'details';
    if v_details is null then v_details := '{}'::jsonb; end if;
    if v_key is null or length(v_key) not between 1 and 120 or
      v_kind not in ('sale', 'purchase', 'expense', 'count') or v_kind is null or
      v_description is null or length(v_description) not between 1 and 300 or
      v_status is null or length(v_status) not between 1 and 80 or
      pg_catalog.jsonb_typeof(v_details) <> 'object' or
      length(v_details::text) > 10000 then
      raise exception 'Campos históricos inválidos' using errcode = '22023';
    end if;
    v_date := (v_record->>'business_date')::date;
    if v_date not between date '1900-01-01' and date '2100-12-31' then
      raise exception 'Fecha histórica inválida' using errcode = '22023';
    end if;
    v_quantity := (v_record->>'quantity')::integer;
    v_amount := (v_record->>'amount')::numeric;
    if v_amount is not null and (v_amount <= 0 or v_amount > 999999999999.99 or
      v_amount <> pg_catalog.round(v_amount, 2)) then
      raise exception 'Importe histórico inválido' using errcode = '22023';
    end if;
    if not (
      (v_kind = 'sale' and v_quantity > 0 and v_amount is not null) or
      (v_kind = 'purchase' and (v_quantity is null or v_quantity > 0) and v_amount is not null) or
      (v_kind = 'expense' and v_quantity is null and v_amount is not null) or
      (v_kind = 'count' and v_quantity >= 0 and v_amount is null)
    ) then raise exception 'Cantidad o importe histórico inválido' using errcode = '22023'; end if;
    v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
      'source_key', v_key, 'kind', v_kind, 'business_date', v_date,
      'description', v_description, 'quantity', v_quantity, 'amount', v_amount,
      'record_status', v_status, 'details', v_details)::text);
    insert into public.historical_records(owner_id, source_key, source_fingerprint,
      kind, business_date, description, quantity, amount, record_status, details)
    values (v_owner, v_key, v_fingerprint, v_kind, v_date, v_description,
      v_quantity, v_amount, v_status, v_details)
    on conflict (owner_id, source_key) do nothing;
    if found then
      v_inserted := v_inserted + 1;
    else
      select source_fingerprint into v_existing from public.historical_records
        where owner_id = v_owner and source_key = v_key;
      if v_existing is distinct from v_fingerprint then
        raise exception 'El registro % ya existe con otros datos', v_key using errcode = '23505';
      end if;
      v_skipped := v_skipped + 1;
    end if;
  end loop;
  return pg_catalog.jsonb_build_object('inserted', v_inserted, 'already_present', v_skipped);
end;
$$;
create function public.import_historical_records(p_records jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.import_historical_records_impl(p_records);
$$;
revoke all on function private.import_historical_records_impl(jsonb) from public, anon;
revoke all on function public.import_historical_records(jsonb) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.import_historical_records_impl(jsonb) to authenticated;
grant execute on function public.import_historical_records(jsonb) to authenticated;
