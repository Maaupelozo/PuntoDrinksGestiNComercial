-- Apply after 202610260001_inventory_pricing.sql. Do not rerun the first migration.
-- Purchases are confirmed atomically and remain immutable. No cancellation RPC
-- exists until a safe reversal policy for downstream sales has been defined.

create table public.suppliers (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  name text not null check (length(pg_catalog.btrim(name)) between 1 and 160),
  phone text not null check (length(pg_catalog.btrim(phone)) between 1 and 80),
  address text check (address is null or length(pg_catalog.btrim(address)) between 1 and 300),
  email text check (email is null or
    (length(email) <= 254 and pg_catalog.strpos(email, '@') > 1)),
  notes text check (notes is null or length(notes) <= 2000),
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, owner_id)
);

create index suppliers_owner_active_name on public.suppliers(owner_id, is_active, name);

create table public.purchases (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  supplier_id uuid,
  purchase_date date not null,
  status text not null default 'confirmed' check (status = 'confirmed'),
  total numeric(14,2) not null default 0 check (total >= 0),
  payment_method text check (payment_method is null or length(pg_catalog.btrim(payment_method)) between 1 and 100),
  notes text check (notes is null or length(notes) <= 2000),
  idempotency_key uuid not null,
  request_fingerprint text not null,
  created_at timestamptz not null default pg_catalog.now(),
  unique (id, owner_id),
  unique (owner_id, idempotency_key),
  foreign key (supplier_id, owner_id) references public.suppliers(id, owner_id) on delete restrict
);

create index purchases_owner_date on public.purchases(owner_id, purchase_date desc, created_at desc);
create index purchases_owner_supplier_date on public.purchases(owner_id, supplier_id, purchase_date desc);

create table public.purchase_items (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  purchase_id uuid not null,
  owner_id uuid not null,
  product_id uuid not null,
  product_name text not null,
  product_sku text,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12,2) not null check (unit_cost >= 0 and unit_cost <> 'NaN'::numeric),
  subtotal numeric(14,2) not null check (subtotal = quantity * unit_cost),
  created_at timestamptz not null default pg_catalog.now(),
  unique (id, purchase_id, owner_id),
  unique (purchase_id, product_id),
  foreign key (purchase_id, owner_id) references public.purchases(id, owner_id) on delete restrict,
  foreign key (product_id, owner_id) references public.products(id, owner_id) on delete restrict
);

create index purchase_items_owner_product on public.purchase_items(owner_id, product_id, created_at desc);

alter table public.inventory_movements
  add column purchase_id uuid,
  add column purchase_item_id uuid,
  add constraint inventory_movements_purchase_fk
    foreign key (purchase_id, owner_id) references public.purchases(id, owner_id) on delete restrict,
  add constraint inventory_movements_purchase_item_fk
    foreign key (purchase_item_id, purchase_id, owner_id)
    references public.purchase_items(id, purchase_id, owner_id) on delete restrict,
  add constraint inventory_movements_purchase_pair_check
    check (purchase_item_id is null or purchase_id is not null);

create index inventory_movements_purchase on public.inventory_movements(purchase_id)
  where purchase_id is not null;

alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;

create policy suppliers_select_own on public.suppliers for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy purchases_select_own on public.purchases for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy purchase_items_select_own on public.purchase_items for select to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.suppliers, public.purchases, public.purchase_items from public, anon, authenticated;
grant select on public.suppliers, public.purchases, public.purchase_items to authenticated;

create trigger suppliers_touch_timestamp before update on public.suppliers
for each row execute function private.touch_product_timestamp();

create function private.create_supplier_impl(
  p_name text, p_phone text, p_address text, p_email text, p_notes text
) returns public.suppliers language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_supplier public.suppliers;
begin
  if v_owner is null then raise exception 'Autenticación requerida' using errcode = '42501'; end if;
  if p_name is null or length(pg_catalog.btrim(p_name)) not between 1 and 160
    or p_phone is null or length(pg_catalog.btrim(p_phone)) not between 1 and 80
    or (p_address is not null and length(pg_catalog.btrim(p_address)) > 300)
    or (p_email is not null and (length(p_email) > 254 or pg_catalog.strpos(p_email, '@') <= 1))
    or (p_notes is not null and length(p_notes) > 2000)
  then raise exception 'Datos de proveedor inválidos' using errcode = '22023'; end if;

  insert into public.suppliers(owner_id, name, phone, address, email, notes)
  values (v_owner, pg_catalog.btrim(p_name), pg_catalog.btrim(p_phone),
    nullif(pg_catalog.btrim(p_address), ''), nullif(pg_catalog.btrim(p_email), ''),
    nullif(pg_catalog.btrim(p_notes), ''))
  returning * into v_supplier;
  return v_supplier;
end;
$$;

create function private.update_supplier_impl(
  p_supplier_id uuid, p_name text, p_phone text, p_address text, p_email text, p_notes text
) returns public.suppliers language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_supplier public.suppliers;
begin
  if v_owner is null then raise exception 'Autenticación requerida' using errcode = '42501'; end if;
  if p_name is null or length(pg_catalog.btrim(p_name)) not between 1 and 160
    or p_phone is null or length(pg_catalog.btrim(p_phone)) not between 1 and 80
    or (p_address is not null and length(pg_catalog.btrim(p_address)) > 300)
    or (p_email is not null and (length(p_email) > 254 or pg_catalog.strpos(p_email, '@') <= 1))
    or (p_notes is not null and length(p_notes) > 2000)
  then raise exception 'Datos de proveedor inválidos' using errcode = '22023'; end if;

  update public.suppliers set name = pg_catalog.btrim(p_name), phone = pg_catalog.btrim(p_phone),
    address = nullif(pg_catalog.btrim(p_address), ''),
    email = nullif(pg_catalog.btrim(p_email), ''),
    notes = nullif(pg_catalog.btrim(p_notes), '')
  where id = p_supplier_id and owner_id = v_owner and is_active
  returning * into v_supplier;
  if not found then raise exception 'Proveedor no encontrado' using errcode = 'P0002'; end if;
  return v_supplier;
end;
$$;

create function private.deactivate_supplier_impl(p_supplier_id uuid)
returns public.suppliers language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_supplier public.suppliers;
begin
  if v_owner is null then raise exception 'Autenticación requerida' using errcode = '42501'; end if;
  update public.suppliers set is_active = false
    where id = p_supplier_id and owner_id = v_owner and is_active
    returning * into v_supplier;
  if not found then raise exception 'Proveedor no encontrado' using errcode = 'P0002'; end if;
  return v_supplier;
end;
$$;

create function private.register_purchase_impl(
  p_idempotency_key uuid, p_purchase_date date, p_supplier_id uuid,
  p_payment_method text, p_notes text, p_items jsonb
) returns public.purchases language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_purchase public.purchases;
  v_product public.products;
  v_item jsonb;
  v_product_id uuid;
  v_supplier_checked uuid;
  v_item_id uuid;
  v_seen uuid[] := array[]::uuid[];
  v_quantity integer;
  v_unit_cost numeric;
  v_subtotal numeric;
  v_total numeric := 0;
  v_old_stock integer;
  v_new_stock integer;
  v_new_cost numeric;
  v_fingerprint text;
begin
  if v_owner is null then raise exception 'Autenticación requerida' using errcode = '42501'; end if;
  if p_idempotency_key is null or p_purchase_date is null
    or p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array'
    or pg_catalog.jsonb_array_length(p_items) not between 1 and 100
    or (p_payment_method is not null and length(pg_catalog.btrim(p_payment_method)) > 100)
    or (p_notes is not null and length(p_notes) > 2000)
  then raise exception 'Datos de compra inválidos' using errcode = '22023'; end if;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'date', p_purchase_date, 'supplier', p_supplier_id,
    'payment', nullif(pg_catalog.btrim(p_payment_method), ''),
    'notes', nullif(pg_catalog.btrim(p_notes), ''), 'items', p_items
  )::text);

  select * into v_purchase from public.purchases
    where owner_id = v_owner and idempotency_key = p_idempotency_key;
  if found then
    if v_purchase.request_fingerprint <> v_fingerprint then
      raise exception 'La clave de idempotencia ya se usó con otra compra' using errcode = '22023';
    end if;
    return v_purchase;
  end if;

  if p_supplier_id is not null then
    select id into v_supplier_checked from public.suppliers
      where id = p_supplier_id and owner_id = v_owner and is_active
      for share;
    if not found then raise exception 'Proveedor no encontrado o inactivo' using errcode = 'P0002'; end if;
  end if;

  insert into public.purchases(owner_id, supplier_id, purchase_date, payment_method, notes,
    idempotency_key, request_fingerprint)
  values (v_owner, p_supplier_id, p_purchase_date,
    nullif(pg_catalog.btrim(p_payment_method), ''),
    nullif(pg_catalog.btrim(p_notes), ''), p_idempotency_key, v_fingerprint)
  on conflict (owner_id, idempotency_key) do nothing
  returning * into v_purchase;

  if not found then
    select * into v_purchase from public.purchases
      where owner_id = v_owner and idempotency_key = p_idempotency_key;
    if v_purchase.request_fingerprint <> v_fingerprint then
      raise exception 'La clave de idempotencia ya se usó con otra compra' using errcode = '22023';
    end if;
    return v_purchase;
  end if;

  -- Lock products in UUID order to avoid deadlocks between multi-product purchases.
  for v_item in
    select value from pg_catalog.jsonb_array_elements(p_items) as items(value)
    order by value->>'product_id'
  loop
    if pg_catalog.jsonb_typeof(v_item) <> 'object' then
      raise exception 'Línea de compra inválida' using errcode = '22023';
    end if;
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_cost := (v_item->>'unit_cost')::numeric;
    if v_product_id is null or v_quantity is null or v_quantity <= 0
      or v_unit_cost is null or v_unit_cost < 0 or v_unit_cost = 'NaN'::numeric
      or v_unit_cost > 9999999999.99 or v_unit_cost <> pg_catalog.round(v_unit_cost, 2)
      or pg_catalog.array_position(v_seen, v_product_id) is not null
    then raise exception 'Línea de compra inválida o producto repetido' using errcode = '22023'; end if;
    v_seen := pg_catalog.array_append(v_seen, v_product_id);

    select * into v_product from public.products
      where id = v_product_id and owner_id = v_owner and is_active
      for update;
    if not found then raise exception 'Producto no encontrado o inactivo' using errcode = 'P0002'; end if;

    v_old_stock := v_product.stock_quantity;
    v_new_stock := v_old_stock + v_quantity;
    v_subtotal := v_quantity::numeric * v_unit_cost;
    v_total := v_total + v_subtotal;
    if v_total > 999999999999.99 then
      raise exception 'El total de compra supera el máximo permitido' using errcode = '22003';
    end if;
    v_new_cost := case when v_old_stock = 0 then v_unit_cost
      else pg_catalog.round((v_old_stock::numeric * v_product.unit_cost + v_subtotal)
        / v_new_stock, 2) end;

    insert into public.purchase_items(purchase_id, owner_id, product_id, product_name,
      product_sku, quantity, unit_cost, subtotal)
    values (v_purchase.id, v_owner, v_product.id, v_product.name, v_product.sku,
      v_quantity, v_unit_cost, v_subtotal)
    returning id into v_item_id;

    update public.products set stock_quantity = v_new_stock, unit_cost = v_new_cost
      where id = v_product.id;

    insert into public.inventory_movements(product_id, owner_id, movement_type,
      quantity_delta, previous_stock, new_stock, reason, purchase_id, purchase_item_id)
    values (v_product.id, v_owner, 'entry', v_quantity, v_old_stock, v_new_stock,
      'Compra de mercadería', v_purchase.id, v_item_id);
  end loop;

  update public.purchases set total = v_total where id = v_purchase.id
    returning * into v_purchase;
  return v_purchase;
end;
$$;

create function public.create_supplier(
  p_name text, p_phone text, p_address text, p_email text, p_notes text
) returns public.suppliers language sql security invoker set search_path = '' as $$
  select private.create_supplier_impl(p_name,p_phone,p_address,p_email,p_notes);
$$;

create function public.update_supplier(
  p_supplier_id uuid, p_name text, p_phone text, p_address text, p_email text, p_notes text
) returns public.suppliers language sql security invoker set search_path = '' as $$
  select private.update_supplier_impl(p_supplier_id,p_name,p_phone,p_address,p_email,p_notes);
$$;

create function public.deactivate_supplier(p_supplier_id uuid)
returns public.suppliers language sql security invoker set search_path = '' as $$
  select private.deactivate_supplier_impl(p_supplier_id);
$$;

create function public.register_purchase(
  p_idempotency_key uuid, p_purchase_date date, p_supplier_id uuid,
  p_payment_method text, p_notes text, p_items jsonb
) returns public.purchases language sql security invoker set search_path = '' as $$
  select private.register_purchase_impl(
    p_idempotency_key,p_purchase_date,p_supplier_id,p_payment_method,p_notes,p_items
  );
$$;

revoke all on function private.create_supplier_impl(text,text,text,text,text) from public, anon;
revoke all on function private.update_supplier_impl(uuid,text,text,text,text,text) from public, anon;
revoke all on function private.deactivate_supplier_impl(uuid) from public, anon;
revoke all on function private.register_purchase_impl(uuid,date,uuid,text,text,jsonb) from public, anon;
grant execute on function private.create_supplier_impl(text,text,text,text,text) to authenticated;
grant execute on function private.update_supplier_impl(uuid,text,text,text,text,text) to authenticated;
grant execute on function private.deactivate_supplier_impl(uuid) to authenticated;
grant execute on function private.register_purchase_impl(uuid,date,uuid,text,text,jsonb) to authenticated;

revoke all on function public.create_supplier(text,text,text,text,text) from public, anon;
revoke all on function public.update_supplier(uuid,text,text,text,text,text) from public, anon;
revoke all on function public.deactivate_supplier(uuid) from public, anon;
revoke all on function public.register_purchase(uuid,date,uuid,text,text,jsonb) from public, anon;
grant execute on function public.create_supplier(text,text,text,text,text) to authenticated;
grant execute on function public.update_supplier(uuid,text,text,text,text,text) to authenticated;
grant execute on function public.deactivate_supplier(uuid) to authenticated;
grant execute on function public.register_purchase(uuid,date,uuid,text,text,jsonb) to authenticated;
