-- Apply after 202610260002_purchases_suppliers.sql, once only.
-- Confirmed sales are immutable. Reversals require a separate audited workflow.

create table public.combos (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  name text not null check (length(pg_catalog.btrim(name)) between 1 and 160),
  description text check (description is null or length(description) <= 2000),
  sale_price numeric(12,2) not null check (sale_price >= 0 and sale_price <> 'NaN'::numeric),
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, owner_id)
);
create index combos_owner_active_name on public.combos(owner_id, is_active, name);
create trigger combos_touch_timestamp before update on public.combos
for each row execute function private.touch_product_timestamp();

create table public.combo_items (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  combo_id uuid not null,
  owner_id uuid not null,
  product_id uuid not null,
  quantity integer not null check (quantity > 0),
  unique (combo_id, product_id),
  foreign key (combo_id, owner_id) references public.combos(id, owner_id) on delete restrict,
  foreign key (product_id, owner_id) references public.products(id, owner_id) on delete restrict
);
create index combo_items_owner_product on public.combo_items(owner_id, product_id);

create table public.sales (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  sale_number text generated always as (id::text) stored,
  sold_at timestamptz not null default pg_catalog.now(),
  payment_method text not null check (payment_method in ('cash', 'transfer', 'mercado_pago')),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  total_cost numeric(14,2) not null default 0 check (total_cost >= 0),
  gross_profit numeric(15,2) generated always as (total_amount - total_cost) stored,
  status text not null default 'confirmed' check (status = 'confirmed'),
  idempotency_key uuid not null,
  request_fingerprint text not null,
  created_at timestamptz not null default pg_catalog.now(),
  unique (id, owner_id),
  unique (owner_id, idempotency_key)
);
create index sales_owner_sold_at on public.sales(owner_id, sold_at desc);

create table public.sale_items (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  sale_id uuid not null,
  owner_id uuid not null,
  product_id uuid,
  combo_id uuid,
  item_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price_snapshot numeric(12,2) not null check (unit_price_snapshot >= 0),
  unit_cost_snapshot numeric(12,2) not null check (unit_cost_snapshot >= 0),
  subtotal numeric(14,2) not null check (subtotal = quantity * unit_price_snapshot),
  total_cost numeric(14,2) not null check (total_cost = quantity * unit_cost_snapshot),
  gross_profit numeric(15,2) generated always as (subtotal - total_cost) stored,
  created_at timestamptz not null default pg_catalog.now(),
  unique (id, sale_id, owner_id),
  check ((product_id is null) <> (combo_id is null)),
  foreign key (sale_id, owner_id) references public.sales(id, owner_id) on delete restrict,
  foreign key (product_id, owner_id) references public.products(id, owner_id) on delete restrict,
  foreign key (combo_id, owner_id) references public.combos(id, owner_id) on delete restrict
);
create index sale_items_owner_sale on public.sale_items(owner_id, sale_id);

create table public.sale_item_components (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  sale_item_id uuid not null,
  sale_id uuid not null,
  owner_id uuid not null,
  product_id uuid not null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_cost_snapshot numeric(12,2) not null check (unit_cost_snapshot >= 0),
  total_cost numeric(14,2) not null check (total_cost = quantity * unit_cost_snapshot),
  unique (sale_item_id, product_id),
  unique (id, sale_id, owner_id),
  foreign key (sale_item_id, sale_id, owner_id)
    references public.sale_items(id, sale_id, owner_id) on delete restrict,
  foreign key (product_id, owner_id) references public.products(id, owner_id) on delete restrict
);
create index sale_components_owner_product on public.sale_item_components(owner_id, product_id);

alter table public.inventory_movements
  add column sale_id uuid,
  add column sale_item_component_id uuid,
  add constraint inventory_movements_sale_fk
    foreign key (sale_id, owner_id) references public.sales(id, owner_id) on delete restrict,
  add constraint inventory_movements_sale_component_fk
    foreign key (sale_item_component_id, sale_id, owner_id)
    references public.sale_item_components(id, sale_id, owner_id) on delete restrict,
  add constraint inventory_movements_sale_pair_check
    check ((sale_id is null) = (sale_item_component_id is null)),
  add constraint inventory_movements_purchase_sale_exclusive
    check (purchase_id is null or sale_id is null);
create index inventory_movements_sale on public.inventory_movements(sale_id)
  where sale_id is not null;

alter table public.combos enable row level security;
alter table public.combo_items enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_item_components enable row level security;
create policy combos_select_own on public.combos for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy combo_items_select_own on public.combo_items for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy sales_select_own on public.sales for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy sale_items_select_own on public.sale_items for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy sale_components_select_own on public.sale_item_components for select to authenticated
  using ((select auth.uid()) = owner_id);
revoke all on public.combos, public.combo_items, public.sales, public.sale_items,
  public.sale_item_components from public, anon, authenticated;
grant select on public.combos, public.combo_items, public.sales, public.sale_items,
  public.sale_item_components to authenticated;

create function private.save_combo_impl(
  p_combo_id uuid, p_name text, p_description text, p_sale_price numeric, p_items jsonb
) returns public.combos language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_combo public.combos;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_seen uuid[] := array[]::uuid[];
  v_checked uuid;
begin
  if v_owner is null then raise exception 'Autenticación requerida' using errcode = '42501'; end if;
  if p_name is null or length(pg_catalog.btrim(p_name)) not between 1 and 160
    or (p_description is not null and length(p_description) > 2000)
    or p_sale_price is null or p_sale_price < 0 or p_sale_price = 'NaN'::numeric
    or p_sale_price > 9999999999.99 or p_sale_price <> pg_catalog.round(p_sale_price, 2)
    or p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array'
    or pg_catalog.jsonb_array_length(p_items) not between 1 and 100
  then raise exception 'Datos de combo inválidos' using errcode = '22023'; end if;

  if p_combo_id is null then
    insert into public.combos(owner_id, name, description, sale_price)
    values (v_owner, pg_catalog.btrim(p_name), nullif(pg_catalog.btrim(p_description), ''), p_sale_price)
    returning * into v_combo;
  else
    select * into v_combo from public.combos
    where id = p_combo_id and owner_id = v_owner and is_active for update;
    if not found then raise exception 'Combo no encontrado o inactivo' using errcode = 'P0002'; end if;
    update public.combos set name = pg_catalog.btrim(p_name),
      description = nullif(pg_catalog.btrim(p_description), ''), sale_price = p_sale_price
      where id = p_combo_id returning * into v_combo;
    delete from public.combo_items where combo_id = p_combo_id;
  end if;

  for v_item in select value from pg_catalog.jsonb_array_elements(p_items) as items(value)
    order by value->>'product_id'
  loop
    if pg_catalog.jsonb_typeof(v_item) <> 'object' then
      raise exception 'Componente inválido' using errcode = '22023'; end if;
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    if v_product_id is null or v_quantity is null or v_quantity <= 0
      or pg_catalog.array_position(v_seen, v_product_id) is not null
    then raise exception 'Componente inválido o repetido' using errcode = '22023'; end if;
    v_seen := pg_catalog.array_append(v_seen, v_product_id);
    select id into v_checked from public.products
      where id = v_product_id and owner_id = v_owner and is_active for share;
    if not found then raise exception 'Producto no encontrado o inactivo' using errcode = 'P0002'; end if;
    insert into public.combo_items(combo_id, owner_id, product_id, quantity)
    values (v_combo.id, v_owner, v_product_id, v_quantity);
  end loop;
  return v_combo;
end;
$$;

create function private.set_combo_active_impl(p_combo_id uuid, p_active boolean)
returns public.combos language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_combo public.combos;
begin
  if v_owner is null then raise exception 'Autenticación requerida' using errcode = '42501'; end if;
  if p_active is null then raise exception 'Estado inválido' using errcode = '22023'; end if;
  update public.combos set is_active = p_active
    where id = p_combo_id and owner_id = v_owner returning * into v_combo;
  if not found then raise exception 'Combo no encontrado' using errcode = 'P0002'; end if;
  return v_combo;
end;
$$;

create function private.confirm_sale_impl(
  p_idempotency_key uuid, p_payment_method text, p_items jsonb
) returns public.sales language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_sale public.sales;
  v_combo public.combos;
  v_product public.products;
  v_item jsonb;
  v_component record;
  v_product_id uuid;
  v_combo_id uuid;
  v_quantity integer;
  v_needed jsonb := '{}'::jsonb;
  v_products jsonb := '{}'::jsonb;
  v_seen text[] := array[]::text[];
  v_fingerprint text;
  v_line_id uuid;
  v_component_id uuid;
  v_unit_price numeric;
  v_unit_cost numeric;
  v_line_cost numeric;
  v_line_total numeric;
  v_total numeric := 0;
  v_cost numeric := 0;
  v_current_stock integer;
begin
  if v_owner is null then raise exception 'Autenticación requerida' using errcode = '42501'; end if;
  if p_idempotency_key is null or p_payment_method not in ('cash','transfer','mercado_pago')
    or p_payment_method is null or p_items is null
    or pg_catalog.jsonb_typeof(p_items) <> 'array'
    or pg_catalog.jsonb_array_length(p_items) not between 1 and 100
  then raise exception 'Datos de venta inválidos' using errcode = '22023'; end if;
  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'payment', p_payment_method, 'items', p_items)::text);
  select * into v_sale from public.sales
    where owner_id = v_owner and idempotency_key = p_idempotency_key;
  if found then
    if v_sale.request_fingerprint <> v_fingerprint then
      raise exception 'La clave de idempotencia ya se usó con otra venta' using errcode = '22023'; end if;
    return v_sale;
  end if;

  -- The unique key serializes simultaneous retries before stock is checked.
  -- The provisional row is invisible until this transaction commits; failures
  -- roll it back along with every other change.
  insert into public.sales(owner_id, payment_method, idempotency_key, request_fingerprint)
  values (v_owner, p_payment_method, p_idempotency_key, v_fingerprint)
  on conflict (owner_id, idempotency_key) do nothing returning * into v_sale;
  if not found then
    select * into v_sale from public.sales
      where owner_id = v_owner and idempotency_key = p_idempotency_key;
    if v_sale.request_fingerprint <> v_fingerprint then
      raise exception 'La clave de idempotencia ya se usó con otra venta' using errcode = '22023'; end if;
    return v_sale;
  end if;

  -- Lock all combos in UUID order; combo editing takes the same lock first.
  for v_combo_id in select distinct (value->>'combo_id')::uuid
    from pg_catalog.jsonb_array_elements(p_items) as entries(value)
    where value->>'combo_id' is not null order by 1
  loop
    select * into v_combo from public.combos
      where id = v_combo_id and owner_id = v_owner and is_active for share;
    if not found then raise exception 'Combo no encontrado o inactivo' using errcode = 'P0002'; end if;
  end loop;

  -- Aggregate needs across standalone products and every combo component.
  for v_item in select value from pg_catalog.jsonb_array_elements(p_items) as entries(value)
  loop
    if pg_catalog.jsonb_typeof(v_item) <> 'object' then
      raise exception 'Línea de venta inválida' using errcode = '22023'; end if;
    v_product_id := (v_item->>'product_id')::uuid;
    v_combo_id := (v_item->>'combo_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    if (v_product_id is null) = (v_combo_id is null)
      or v_quantity is null or v_quantity <= 0 or v_quantity > 1000000
      or pg_catalog.array_position(v_seen,
        case when v_product_id is null then 'c:' || v_combo_id::text else 'p:' || v_product_id::text end) is not null
    then raise exception 'Línea de venta inválida o repetida' using errcode = '22023'; end if;
    v_seen := pg_catalog.array_append(v_seen,
      case when v_product_id is null then 'c:' || v_combo_id::text else 'p:' || v_product_id::text end);
    if v_product_id is not null then
      v_needed := pg_catalog.jsonb_set(v_needed, array[v_product_id::text],
        pg_catalog.to_jsonb(coalesce((v_needed->>v_product_id::text)::numeric, 0) + v_quantity));
    else
      for v_component in select product_id, quantity from public.combo_items
        where combo_id = v_combo_id and owner_id = v_owner order by product_id
      loop
        v_needed := pg_catalog.jsonb_set(v_needed, array[v_component.product_id::text],
          pg_catalog.to_jsonb(coalesce((v_needed->>v_component.product_id::text)::numeric, 0)
            + v_component.quantity::numeric * v_quantity));
      end loop;
      if not found then raise exception 'Combo sin componentes' using errcode = '22023'; end if;
    end if;
  end loop;

  -- Product locks always follow UUID order, including mixed carts.
  for v_product_id in select key::uuid from pg_catalog.jsonb_each(v_needed) order by 1
  loop
    select * into v_product from public.products
      where id = v_product_id and owner_id = v_owner and is_active for update;
    if not found then raise exception 'Producto no encontrado o inactivo' using errcode = 'P0002'; end if;
    if (v_needed->>v_product_id::text)::numeric > v_product.stock_quantity then
      raise exception 'Stock insuficiente para %: disponibles %, solicitados %',
        v_product.name, v_product.stock_quantity, v_needed->>v_product_id::text
        using errcode = '22023';
    end if;
    v_products := pg_catalog.jsonb_set(v_products, array[v_product_id::text],
      pg_catalog.to_jsonb(v_product));
  end loop;

  for v_item in select value from pg_catalog.jsonb_array_elements(p_items) as entries(value)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_combo_id := (v_item->>'combo_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    if v_product_id is not null then
      v_product := pg_catalog.jsonb_populate_record(null::public.products, v_products->v_product_id::text);
      v_unit_price := v_product.sale_price;
      v_unit_cost := v_product.unit_cost;
      v_line_cost := v_quantity * v_unit_cost;
      insert into public.sale_items(sale_id, owner_id, product_id, item_name, quantity,
        unit_price_snapshot, unit_cost_snapshot, subtotal, total_cost)
      values (v_sale.id, v_owner, v_product_id, v_product.name, v_quantity,
        v_unit_price, v_unit_cost, v_quantity * v_unit_price, v_line_cost)
      returning id into v_line_id;
      insert into public.sale_item_components(sale_item_id, sale_id, owner_id,
        product_id, product_name, quantity, unit_cost_snapshot, total_cost)
      values (v_line_id, v_sale.id, v_owner, v_product_id, v_product.name,
        v_quantity, v_unit_cost, v_line_cost) returning id into v_component_id;
      insert into public.inventory_movements(product_id, owner_id, movement_type,
        quantity_delta, previous_stock, new_stock, reason, sale_id, sale_item_component_id)
      values (v_product_id, v_owner, 'exit', -v_quantity,
        v_product.stock_quantity, v_product.stock_quantity - v_quantity,
        'Venta confirmada', v_sale.id, v_component_id);
      v_line_total := v_quantity * v_unit_price;
    else
      select * into v_combo from public.combos where id = v_combo_id and owner_id = v_owner;
      v_unit_price := v_combo.sale_price;
      v_unit_cost := 0;
      for v_component in select product_id, quantity from public.combo_items
        where combo_id = v_combo_id and owner_id = v_owner order by product_id
      loop
        v_product := pg_catalog.jsonb_populate_record(null::public.products,
          v_products->v_component.product_id::text);
        v_unit_cost := v_unit_cost + v_component.quantity * v_product.unit_cost;
      end loop;
      v_line_cost := v_quantity * v_unit_cost;
      insert into public.sale_items(sale_id, owner_id, combo_id, item_name, quantity,
        unit_price_snapshot, unit_cost_snapshot, subtotal, total_cost)
      values (v_sale.id, v_owner, v_combo_id, v_combo.name, v_quantity,
        v_unit_price, v_unit_cost, v_quantity * v_unit_price, v_line_cost)
      returning id into v_line_id;
      for v_component in select product_id, quantity from public.combo_items
        where combo_id = v_combo_id and owner_id = v_owner order by product_id
      loop
        v_product := pg_catalog.jsonb_populate_record(null::public.products,
          v_products->v_component.product_id::text);
        insert into public.sale_item_components(sale_item_id, sale_id, owner_id,
          product_id, product_name, quantity, unit_cost_snapshot, total_cost)
        values (v_line_id, v_sale.id, v_owner, v_product.id, v_product.name,
          v_quantity * v_component.quantity, v_product.unit_cost,
          v_quantity * v_component.quantity * v_product.unit_cost)
        returning id into v_component_id;
        insert into public.inventory_movements(product_id, owner_id, movement_type,
          quantity_delta, previous_stock, new_stock, reason, sale_id, sale_item_component_id)
        values (v_product.id, v_owner, 'exit', -v_quantity * v_component.quantity,
          v_product.stock_quantity, v_product.stock_quantity - v_quantity * v_component.quantity,
          'Venta de combo', v_sale.id, v_component_id);
      end loop;
      v_line_total := v_quantity * v_unit_price;
    end if;
    v_total := v_total + v_line_total;
    v_cost := v_cost + v_line_cost;
    if v_total > 999999999999.99 or v_cost > 999999999999.99 then
      raise exception 'El total de venta supera el máximo permitido' using errcode = '22003'; end if;
  end loop;

  -- Correct movement snapshots for products shared by multiple lines, then
  -- decrement stock exactly once per product. Costs remain unchanged.
  for v_product_id in select key::uuid from pg_catalog.jsonb_each(v_needed) order by 1
  loop
    v_product := pg_catalog.jsonb_populate_record(null::public.products,
      v_products->v_product_id::text);
    v_current_stock := v_product.stock_quantity;
    for v_component in select m.id, m.quantity_delta from public.inventory_movements m
      where m.sale_id = v_sale.id and m.product_id = v_product_id order by m.id
    loop
      update public.inventory_movements set previous_stock = v_current_stock,
        new_stock = v_current_stock + v_component.quantity_delta where id = v_component.id;
      v_current_stock := v_current_stock + v_component.quantity_delta;
    end loop;
    update public.products set stock_quantity = v_current_stock where id = v_product_id;
  end loop;
  update public.sales set total_amount = v_total, total_cost = v_cost
    where id = v_sale.id returning * into v_sale;
  return v_sale;
end;
$$;

create function public.save_combo(p_combo_id uuid, p_name text, p_description text,
  p_sale_price numeric, p_items jsonb)
returns public.combos language sql security invoker set search_path = '' as $$
  select private.save_combo_impl(p_combo_id,p_name,p_description,p_sale_price,p_items);
$$;
create function public.set_combo_active(p_combo_id uuid, p_active boolean)
returns public.combos language sql security invoker set search_path = '' as $$
  select private.set_combo_active_impl(p_combo_id,p_active);
$$;
create function public.confirm_sale(p_idempotency_key uuid, p_payment_method text, p_items jsonb)
returns public.sales language sql security invoker set search_path = '' as $$
  select private.confirm_sale_impl(p_idempotency_key,p_payment_method,p_items);
$$;

revoke all on function private.save_combo_impl(uuid,text,text,numeric,jsonb) from public, anon;
revoke all on function private.set_combo_active_impl(uuid,boolean) from public, anon;
revoke all on function private.confirm_sale_impl(uuid,text,jsonb) from public, anon;
grant execute on function private.save_combo_impl(uuid,text,text,numeric,jsonb) to authenticated;
grant execute on function private.set_combo_active_impl(uuid,boolean) to authenticated;
grant execute on function private.confirm_sale_impl(uuid,text,jsonb) to authenticated;
revoke all on function public.save_combo(uuid,text,text,numeric,jsonb) from public, anon;
revoke all on function public.set_combo_active(uuid,boolean) from public, anon;
revoke all on function public.confirm_sale(uuid,text,jsonb) from public, anon;
grant execute on function public.save_combo(uuid,text,text,numeric,jsonb) to authenticated;
grant execute on function public.set_combo_active(uuid,boolean) to authenticated;
grant execute on function public.confirm_sale(uuid,text,jsonb) to authenticated;
