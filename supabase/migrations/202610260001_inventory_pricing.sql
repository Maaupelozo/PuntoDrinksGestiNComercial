-- Run as the migration owner (postgres). Browser clients receive only SELECT
-- grants; all mutations pass through the narrowly granted functions below.
create schema if not exists private;

create table public.products (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  name text not null check (length(pg_catalog.btrim(name)) between 1 and 160),
  category text not null check (length(pg_catalog.btrim(category)) between 1 and 100),
  sku text check (sku is null or length(pg_catalog.btrim(sku)) between 1 and 80),
  unit_cost numeric(12,2) not null check (unit_cost >= 0 and unit_cost <> 'NaN'::numeric),
  sale_price numeric(12,2) not null check (sale_price >= 0 and sale_price <> 'NaN'::numeric),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  min_stock integer not null default 0 check (min_stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, owner_id)
);

create unique index products_owner_sku_unique on public.products(owner_id, pg_catalog.lower(sku)) where sku is not null;
create index products_owner_active_name on public.products(owner_id, is_active, name);
create index products_owner_category on public.products(owner_id, category);

create table public.inventory_movements (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  product_id uuid not null,
  owner_id uuid not null,
  movement_type text not null check (movement_type in ('entry', 'exit', 'adjustment')),
  quantity_delta integer not null check (
    quantity_delta <> 0 and
    (movement_type <> 'entry' or quantity_delta > 0) and
    (movement_type <> 'exit' or quantity_delta < 0)
  ),
  previous_stock integer not null check (previous_stock >= 0),
  new_stock integer not null check (new_stock >= 0 and new_stock = previous_stock + quantity_delta),
  reason text not null check (length(pg_catalog.btrim(reason)) between 1 and 500),
  created_at timestamptz not null default pg_catalog.now(),
  foreign key (product_id, owner_id) references public.products(id, owner_id) on delete restrict
);

create index inventory_movements_owner_product_date on public.inventory_movements(owner_id, product_id, created_at desc);

create table public.price_history (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  product_id uuid not null,
  owner_id uuid not null,
  previous_cost numeric(12,2) not null,
  new_cost numeric(12,2) not null,
  previous_price numeric(12,2) not null,
  new_price numeric(12,2) not null,
  changed_at timestamptz not null default pg_catalog.now(),
  foreign key (product_id, owner_id) references public.products(id, owner_id) on delete restrict
);

create index price_history_owner_product_date on public.price_history(owner_id, product_id, changed_at desc);

alter table public.products enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.price_history enable row level security;

create policy products_select_own on public.products for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy inventory_movements_select_own on public.inventory_movements for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy price_history_select_own on public.price_history for select to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.products, public.inventory_movements, public.price_history from public, anon, authenticated;
grant select on public.products, public.inventory_movements, public.price_history to authenticated;

create function private.touch_product_timestamp()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger products_touch_timestamp before update on public.products
for each row execute function private.touch_product_timestamp();

create function private.record_price_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.unit_cost is distinct from new.unit_cost or old.sale_price is distinct from new.sale_price then
    insert into public.price_history
      (product_id, owner_id, previous_cost, new_cost, previous_price, new_price)
    values
      (new.id, new.owner_id, old.unit_cost, new.unit_cost, old.sale_price, new.sale_price);
  end if;
  return new;
end;
$$;

create trigger products_record_price_change after update of unit_cost, sale_price on public.products
for each row execute function private.record_price_change();

revoke all on function private.touch_product_timestamp() from public, anon, authenticated;
revoke all on function private.record_price_change() from public, anon, authenticated;

create function private.create_product_impl(
  p_name text, p_category text, p_sku text, p_unit_cost numeric,
  p_sale_price numeric, p_initial_stock integer, p_min_stock integer
)
returns public.products language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_product public.products;
begin
  if v_owner is null then raise exception 'Autenticación requerida' using errcode = '42501'; end if;
  if p_name is null or length(pg_catalog.btrim(p_name)) not between 1 and 160
    or p_category is null or length(pg_catalog.btrim(p_category)) not between 1 and 100
    or (p_sku is not null and length(pg_catalog.btrim(p_sku)) not between 1 and 80)
    or p_unit_cost is null or p_unit_cost < 0 or p_unit_cost = 'NaN'::numeric
    or p_sale_price is null or p_sale_price < 0 or p_sale_price = 'NaN'::numeric
    or p_initial_stock is null or p_initial_stock < 0
    or p_min_stock is null or p_min_stock < 0
  then raise exception 'Datos de producto inválidos' using errcode = '22023'; end if;

  insert into public.products (owner_id, name, category, sku, unit_cost, sale_price, stock_quantity, min_stock)
  values (v_owner, pg_catalog.btrim(p_name), pg_catalog.btrim(p_category),
          nullif(pg_catalog.btrim(p_sku), ''), p_unit_cost, p_sale_price, p_initial_stock, p_min_stock)
  returning * into v_product;

  if p_initial_stock > 0 then
    insert into public.inventory_movements
      (product_id, owner_id, movement_type, quantity_delta, previous_stock, new_stock, reason)
    values (v_product.id, v_owner, 'entry', p_initial_stock, 0, p_initial_stock, 'Stock inicial');
  end if;
  return v_product;
end;
$$;

create function private.update_product_impl(
  p_product_id uuid, p_name text, p_category text, p_sku text,
  p_unit_cost numeric, p_sale_price numeric, p_min_stock integer
)
returns public.products language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_product public.products;
begin
  if v_owner is null then raise exception 'Autenticación requerida' using errcode = '42501'; end if;
  if p_name is null or length(pg_catalog.btrim(p_name)) not between 1 and 160
    or p_category is null or length(pg_catalog.btrim(p_category)) not between 1 and 100
    or (p_sku is not null and length(pg_catalog.btrim(p_sku)) not between 1 and 80)
    or p_min_stock is null or p_min_stock < 0
    or p_unit_cost is null or p_unit_cost < 0 or p_unit_cost = 'NaN'::numeric
    or p_sale_price is null or p_sale_price < 0 or p_sale_price = 'NaN'::numeric
  then raise exception 'Datos de producto inválidos' using errcode = '22023'; end if;

  update public.products set name = pg_catalog.btrim(p_name), category = pg_catalog.btrim(p_category),
    sku = nullif(pg_catalog.btrim(p_sku), ''), min_stock = p_min_stock,
    unit_cost = p_unit_cost, sale_price = p_sale_price
  where id = p_product_id and owner_id = v_owner and is_active
  returning * into v_product;
  if not found then raise exception 'Producto no encontrado' using errcode = 'P0002'; end if;
  return v_product;
end;
$$;

create function private.deactivate_product_impl(p_product_id uuid)
returns public.products language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_product public.products;
begin
  if v_owner is null then raise exception 'Autenticación requerida' using errcode = '42501'; end if;
  update public.products set is_active = false
    where id = p_product_id and owner_id = v_owner and is_active
    returning * into v_product;
  if not found then raise exception 'Producto no encontrado' using errcode = 'P0002'; end if;
  return v_product;
end;
$$;

create function private.update_product_prices_impl(p_product_id uuid, p_unit_cost numeric, p_sale_price numeric)
returns public.products language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_product public.products;
begin
  if v_owner is null then raise exception 'Autenticación requerida' using errcode = '42501'; end if;
  if p_unit_cost is null or p_unit_cost < 0 or p_unit_cost = 'NaN'::numeric
    or p_sale_price is null or p_sale_price < 0 or p_sale_price = 'NaN'::numeric
  then raise exception 'Costo o precio inválido' using errcode = '22023'; end if;

  update public.products set unit_cost = p_unit_cost, sale_price = p_sale_price
    where id = p_product_id and owner_id = v_owner and is_active
    returning * into v_product;
  if not found then raise exception 'Producto no encontrado' using errcode = 'P0002'; end if;
  return v_product;
end;
$$;

create function private.adjust_stock_impl(
  p_product_id uuid, p_movement_type text, p_quantity_delta integer, p_reason text
)
returns public.products language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_product public.products;
  v_new_stock integer;
begin
  if v_owner is null then raise exception 'Autenticación requerida' using errcode = '42501'; end if;
  if p_movement_type not in ('entry', 'exit', 'adjustment') or p_movement_type is null
    or p_quantity_delta is null or p_quantity_delta = 0
    or (p_movement_type = 'entry' and p_quantity_delta < 0)
    or (p_movement_type = 'exit' and p_quantity_delta > 0)
    or p_reason is null or length(pg_catalog.btrim(p_reason)) not between 1 and 500
  then raise exception 'Movimiento inválido' using errcode = '22023'; end if;

  select * into v_product from public.products
    where id = p_product_id and owner_id = v_owner and is_active
    for update;
  if not found then raise exception 'Producto no encontrado' using errcode = 'P0002'; end if;

  v_new_stock := v_product.stock_quantity + p_quantity_delta;
  if v_new_stock < 0 then raise exception 'Stock insuficiente' using errcode = '23514'; end if;

  update public.products set stock_quantity = v_new_stock where id = v_product.id
    returning * into v_product;
  insert into public.inventory_movements
    (product_id, owner_id, movement_type, quantity_delta, previous_stock, new_stock, reason)
  values
    (v_product.id, v_owner, p_movement_type, p_quantity_delta,
     v_product.stock_quantity - p_quantity_delta, v_product.stock_quantity, pg_catalog.btrim(p_reason));
  return v_product;
end;
$$;

-- Public RPCs are SECURITY INVOKER wrappers. The privileged bodies stay in
-- private, which must not be in the API's list of exposed schemas.
create function public.create_product(
  p_name text, p_category text, p_sku text, p_unit_cost numeric,
  p_sale_price numeric, p_initial_stock integer, p_min_stock integer
) returns public.products language sql security invoker set search_path = '' as $$
  select private.create_product_impl(p_name,p_category,p_sku,p_unit_cost,p_sale_price,p_initial_stock,p_min_stock);
$$;

create function public.update_product(
  p_product_id uuid, p_name text, p_category text, p_sku text,
  p_unit_cost numeric, p_sale_price numeric, p_min_stock integer
) returns public.products language sql security invoker set search_path = '' as $$
  select private.update_product_impl(p_product_id,p_name,p_category,p_sku,p_unit_cost,p_sale_price,p_min_stock);
$$;

create function public.deactivate_product(p_product_id uuid)
returns public.products language sql security invoker set search_path = '' as $$
  select private.deactivate_product_impl(p_product_id);
$$;

create function public.update_product_prices(p_product_id uuid, p_unit_cost numeric, p_sale_price numeric)
returns public.products language sql security invoker set search_path = '' as $$
  select private.update_product_prices_impl(p_product_id,p_unit_cost,p_sale_price);
$$;

create function public.adjust_stock(
  p_product_id uuid, p_movement_type text, p_quantity_delta integer, p_reason text
) returns public.products language sql security invoker set search_path = '' as $$
  select private.adjust_stock_impl(p_product_id,p_movement_type,p_quantity_delta,p_reason);
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

revoke all on function private.create_product_impl(text,text,text,numeric,numeric,integer,integer) from public, anon;
revoke all on function private.update_product_impl(uuid,text,text,text,numeric,numeric,integer) from public, anon;
revoke all on function private.deactivate_product_impl(uuid) from public, anon;
revoke all on function private.update_product_prices_impl(uuid,numeric,numeric) from public, anon;
revoke all on function private.adjust_stock_impl(uuid,text,integer,text) from public, anon;

grant execute on function private.create_product_impl(text,text,text,numeric,numeric,integer,integer) to authenticated;
grant execute on function private.update_product_impl(uuid,text,text,text,numeric,numeric,integer) to authenticated;
grant execute on function private.deactivate_product_impl(uuid) to authenticated;
grant execute on function private.update_product_prices_impl(uuid,numeric,numeric) to authenticated;
grant execute on function private.adjust_stock_impl(uuid,text,integer,text) to authenticated;

revoke all on function public.create_product(text,text,text,numeric,numeric,integer,integer) from public, anon;
revoke all on function public.update_product(uuid,text,text,text,numeric,numeric,integer) from public, anon;
revoke all on function public.deactivate_product(uuid) from public, anon;
revoke all on function public.update_product_prices(uuid,numeric,numeric) from public, anon;
revoke all on function public.adjust_stock(uuid,text,integer,text) from public, anon;

grant execute on function public.create_product(text,text,text,numeric,numeric,integer,integer) to authenticated;
grant execute on function public.update_product(uuid,text,text,text,numeric,numeric,integer) to authenticated;
grant execute on function public.deactivate_product(uuid) to authenticated;
grant execute on function public.update_product_prices(uuid,numeric,numeric) to authenticated;
grant execute on function public.adjust_stock(uuid,text,integer,text) to authenticated;
