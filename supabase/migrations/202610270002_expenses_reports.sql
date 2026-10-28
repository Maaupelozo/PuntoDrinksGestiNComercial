-- Apply once after 202610270001_sales_combos.sql.
-- Financial periods use [start_date, end_date) in America/Argentina/Cordoba.

create table public.expenses (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  expense_date date not null,
  description text not null check (length(pg_catalog.btrim(description)) between 1 and 300),
  category text not null check (length(pg_catalog.btrim(category)) between 1 and 100),
  amount numeric(12,2) not null check (amount > 0 and amount <> 'NaN'::numeric),
  payment_method text not null check (payment_method in
    ('cash','transfer','mercado_pago','debit','credit','other')),
  notes text check (notes is null or length(notes) <= 2000),
  status text not null default 'posted' check (status in ('posted','voided')),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, owner_id),
  check ((status = 'posted' and voided_at is null and voided_by is null and void_reason is null)
    or (status = 'voided' and voided_at is not null and voided_by is not null
      and length(pg_catalog.btrim(void_reason)) between 1 and 500))
);
create index expenses_owner_date on public.expenses(owner_id, expense_date desc, created_at desc);
create index expenses_owner_category_date on public.expenses(owner_id, category, expense_date desc);
create trigger expenses_touch_timestamp before update on public.expenses
for each row execute function private.touch_product_timestamp();

create table public.expense_audit (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  expense_id uuid not null,
  owner_id uuid not null,
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('created','updated','voided')),
  old_record jsonb,
  new_record jsonb not null,
  created_at timestamptz not null default pg_catalog.now(),
  foreign key (expense_id, owner_id) references public.expenses(id, owner_id) on delete restrict
);
create index expense_audit_owner_expense_date on public.expense_audit(owner_id, expense_id, created_at desc);

alter table public.expenses enable row level security;
alter table public.expense_audit enable row level security;
create policy expenses_select_own on public.expenses for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy expense_audit_select_own on public.expense_audit for select to authenticated
  using ((select auth.uid()) = owner_id);
revoke all on public.expenses, public.expense_audit from public, anon, authenticated;
grant select on public.expenses, public.expense_audit to authenticated;

create function private.record_expense_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.expense_audit(expense_id, owner_id, actor_id, action, old_record, new_record)
  values (new.id, new.owner_id, auth.uid(),
    case when tg_op = 'INSERT' then 'created'
      when new.status = 'voided' and old.status <> 'voided' then 'voided'
      else 'updated' end,
    case when tg_op = 'INSERT' then null else pg_catalog.to_jsonb(old) end,
    pg_catalog.to_jsonb(new));
  return new;
end;
$$;
create trigger expenses_record_audit after insert or update on public.expenses
for each row execute function private.record_expense_audit();
revoke all on function private.record_expense_audit() from public, anon, authenticated;

create function private.save_expense_impl(
  p_expense_id uuid, p_expense_date date, p_description text, p_category text,
  p_amount numeric, p_payment_method text, p_notes text
) returns public.expenses language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_expense public.expenses;
begin
  if v_owner is null then raise exception 'Autenticación requerida' using errcode = '42501'; end if;
  if p_expense_date is null or p_expense_date < date '1900-01-01'
    or p_expense_date > date '2100-12-31'
    or p_description is null or length(pg_catalog.btrim(p_description)) not between 1 and 300
    or p_category is null or length(pg_catalog.btrim(p_category)) not between 1 and 100
    or p_amount is null or p_amount <= 0 or p_amount = 'NaN'::numeric
    or p_amount > 9999999999.99 or p_amount <> pg_catalog.round(p_amount, 2)
    or p_payment_method is null or p_payment_method not in
      ('cash','transfer','mercado_pago','debit','credit','other')
    or (p_notes is not null and length(p_notes) > 2000)
  then raise exception 'Datos de gasto inválidos' using errcode = '22023'; end if;
  if p_expense_id is null then
    insert into public.expenses(owner_id, expense_date, description, category,
      amount, payment_method, notes)
    values (v_owner, p_expense_date, pg_catalog.btrim(p_description),
      pg_catalog.btrim(p_category), p_amount, p_payment_method,
      nullif(pg_catalog.btrim(p_notes), ''))
    returning * into v_expense;
  else
    update public.expenses set expense_date = p_expense_date,
      description = pg_catalog.btrim(p_description),
      category = pg_catalog.btrim(p_category), amount = p_amount,
      payment_method = p_payment_method, notes = nullif(pg_catalog.btrim(p_notes), '')
    where id = p_expense_id and owner_id = v_owner and status = 'posted'
    returning * into v_expense;
    if not found then raise exception 'Gasto no encontrado o anulado' using errcode = 'P0002'; end if;
  end if;
  return v_expense;
end;
$$;

create function private.void_expense_impl(p_expense_id uuid, p_reason text)
returns public.expenses language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_expense public.expenses;
begin
  if v_owner is null then raise exception 'Autenticación requerida' using errcode = '42501'; end if;
  if p_reason is null or length(pg_catalog.btrim(p_reason)) not between 1 and 500
  then raise exception 'Indicá el motivo de la anulación' using errcode = '22023'; end if;
  update public.expenses set status = 'voided', voided_at = pg_catalog.now(),
    voided_by = v_owner, void_reason = pg_catalog.btrim(p_reason)
  where id = p_expense_id and owner_id = v_owner and status = 'posted'
  returning * into v_expense;
  if not found then raise exception 'Gasto no encontrado o ya anulado' using errcode = 'P0002'; end if;
  return v_expense;
end;
$$;

create function public.save_expense(p_expense_id uuid, p_expense_date date,
  p_description text, p_category text, p_amount numeric,
  p_payment_method text, p_notes text)
returns public.expenses language sql security invoker set search_path = '' as $$
  select private.save_expense_impl(p_expense_id,p_expense_date,p_description,
    p_category,p_amount,p_payment_method,p_notes);
$$;
create function public.void_expense(p_expense_id uuid, p_reason text)
returns public.expenses language sql security invoker set search_path = '' as $$
  select private.void_expense_impl(p_expense_id,p_reason);
$$;
revoke all on function private.save_expense_impl(uuid,date,text,text,numeric,text,text) from public, anon;
revoke all on function private.void_expense_impl(uuid,text) from public, anon;
grant execute on function private.save_expense_impl(uuid,date,text,text,numeric,text,text) to authenticated;
grant execute on function private.void_expense_impl(uuid,text) to authenticated;
revoke all on function public.save_expense(uuid,date,text,text,numeric,text,text) from public, anon;
revoke all on function public.void_expense(uuid,text) from public, anon;
grant execute on function public.save_expense(uuid,date,text,text,numeric,text,text) to authenticated;
grant execute on function public.void_expense(uuid,text) to authenticated;

-- Read-only, SECURITY INVOKER: RLS applies, with an explicit owner predicate.
-- Separate aggregates prevent multiplying totals through one-to-many joins.
create function public.financial_report(p_start_date date, p_end_date date)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_start timestamptz;
  v_end timestamptz;
  v_revenue numeric := 0;
  v_cogs numeric := 0;
  v_sales_count integer := 0;
  v_expenses numeric := 0;
  v_expense_count integer := 0;
  v_purchases numeric := 0;
  v_purchase_count integer := 0;
  v_daily jsonb;
  v_categories jsonb;
  v_top_products jsonb;
  v_top_purchased jsonb;
  v_suppliers jsonb;
  v_recent jsonb;
  v_alerts jsonb;
  v_available integer;
  v_low integer;
  v_out integer;
  v_inventory_value numeric;
begin
  if v_owner is null then raise exception 'Autenticación requerida' using errcode = '42501'; end if;
  if p_start_date is null or p_end_date is null or p_end_date <= p_start_date
    or p_end_date - p_start_date > 3660
  then raise exception 'Período financiero inválido' using errcode = '22023'; end if;
  v_start := p_start_date::timestamp at time zone 'America/Argentina/Cordoba';
  v_end := p_end_date::timestamp at time zone 'America/Argentina/Cordoba';

  select coalesce(sum(total_amount),0), coalesce(sum(total_cost),0), count(*)::integer
    into v_revenue, v_cogs, v_sales_count
  from public.sales where owner_id = v_owner and status = 'confirmed'
    and sold_at >= v_start and sold_at < v_end;
  select coalesce(sum(amount),0), count(*)::integer into v_expenses, v_expense_count
  from public.expenses where owner_id = v_owner and status = 'posted'
    and expense_date >= p_start_date and expense_date < p_end_date;
  select coalesce(sum(total),0), count(*)::integer into v_purchases, v_purchase_count
  from public.purchases where owner_id = v_owner and status = 'confirmed'
    and purchase_date >= p_start_date and purchase_date < p_end_date;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'date', d.day, 'revenue', coalesce(s.revenue,0), 'cogs', coalesce(s.cogs,0),
    'gross_profit', coalesce(s.revenue,0)-coalesce(s.cogs,0),
    'expenses', coalesce(e.expenses,0), 'purchases', coalesce(p.purchases,0),
    'sales_count', coalesce(s.sales_count,0)) order by d.day), '[]'::jsonb)
  into v_daily
  from pg_catalog.generate_series(p_start_date::timestamp,
    (p_end_date - 1)::timestamp, interval '1 day') as d(day)
  left join (
    select (sold_at at time zone 'America/Argentina/Cordoba')::date as day,
      sum(total_amount) as revenue, sum(total_cost) as cogs, count(*)::integer as sales_count
    from public.sales where owner_id = v_owner and status = 'confirmed'
      and sold_at >= v_start and sold_at < v_end group by 1
  ) s on s.day = d.day::date
  left join (
    select expense_date as day, sum(amount) as expenses from public.expenses
      where owner_id = v_owner and status = 'posted'
        and expense_date >= p_start_date and expense_date < p_end_date group by 1
  ) e on e.day = d.day::date
  left join (
    select purchase_date as day, sum(total) as purchases from public.purchases
      where owner_id = v_owner and status = 'confirmed'
        and purchase_date >= p_start_date and purchase_date < p_end_date group by 1
  ) p on p.day = d.day::date;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.total desc), '[]'::jsonb)
    into v_categories from (
    select category, sum(amount) as total, count(*)::integer as count
    from public.expenses where owner_id = v_owner and status = 'posted'
      and expense_date >= p_start_date and expense_date < p_end_date
    group by category
  ) x;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.units desc), '[]'::jsonb)
    into v_top_products from (
    select c.product_id, max(c.product_name) as name, sum(c.quantity)::integer as units,
      coalesce(max(individual.direct_revenue),0) as direct_revenue
    from public.sale_item_components c
    join public.sales s on s.id = c.sale_id and s.owner_id = v_owner
    left join (
      select i.product_id, sum(i.subtotal) as direct_revenue
      from public.sale_items i join public.sales si on si.id = i.sale_id
      where si.owner_id = v_owner and si.status = 'confirmed'
        and si.sold_at >= v_start and si.sold_at < v_end
        and i.product_id is not null group by i.product_id
    ) individual on individual.product_id = c.product_id
    where c.owner_id = v_owner and s.status = 'confirmed'
      and s.sold_at >= v_start and s.sold_at < v_end
    group by c.product_id order by units desc limit 5
  ) x;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.units desc), '[]'::jsonb)
    into v_top_purchased from (
    select i.product_id, max(i.product_name) as name,
      sum(i.quantity)::integer as units, sum(i.subtotal) as total
    from public.purchase_items i join public.purchases p on p.id = i.purchase_id
    where p.owner_id = v_owner and p.status = 'confirmed'
      and p.purchase_date >= p_start_date and p.purchase_date < p_end_date
    group by i.product_id order by units desc limit 5
  ) x;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.total desc), '[]'::jsonb)
    into v_suppliers from (
    select p.supplier_id, coalesce(max(s.name),'Sin proveedor') as name,
      sum(p.total) as total, count(*)::integer as purchases
    from public.purchases p left join public.suppliers s
      on s.id = p.supplier_id and s.owner_id = v_owner
    where p.owner_id = v_owner and p.status = 'confirmed'
      and p.purchase_date >= p_start_date and p.purchase_date < p_end_date
    group by p.supplier_id
  ) x;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.sold_at desc), '[]'::jsonb)
    into v_recent from (
    select id, sale_number, sold_at, payment_method, total_amount, gross_profit
    from public.sales where owner_id = v_owner and status = 'confirmed'
      and sold_at >= v_start and sold_at < v_end
    order by sold_at desc limit 5
  ) x;

  select count(*) filter (where stock_quantity > 0)::integer,
    count(*) filter (where stock_quantity > 0 and stock_quantity <= min_stock)::integer,
    count(*) filter (where stock_quantity = 0)::integer,
    coalesce(sum(stock_quantity::numeric * unit_cost),0)
    into v_available, v_low, v_out, v_inventory_value
  from public.products where owner_id = v_owner and is_active;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.stock_quantity, x.name), '[]'::jsonb)
    into v_alerts from (
    select id, name, stock_quantity, min_stock from public.products
    where owner_id = v_owner and is_active and stock_quantity <= min_stock
    order by stock_quantity, name limit 5
  ) x;

  return pg_catalog.jsonb_build_object(
    'period', pg_catalog.jsonb_build_object('start',p_start_date,'end_exclusive',p_end_date),
    'summary', pg_catalog.jsonb_build_object(
      'revenue',v_revenue,'cogs',v_cogs,'gross_profit',v_revenue-v_cogs,
      'expenses',v_expenses,'net_operating_result',v_revenue-v_cogs-v_expenses,
      'purchases',v_purchases,'cashflow_estimate',v_revenue-v_purchases-v_expenses,
      'sales_count',v_sales_count,'expense_count',v_expense_count,
      'purchase_count',v_purchase_count,
      'average_ticket',case when v_sales_count = 0 then 0
        else pg_catalog.round(v_revenue/v_sales_count,2) end),
    'daily',v_daily,'expense_categories',v_categories,
    'top_products',v_top_products,'top_purchased',v_top_purchased,
    'supplier_totals',v_suppliers,'recent_sales',v_recent,
    'inventory',pg_catalog.jsonb_build_object('available_products',v_available,
      'low_stock_products',v_low,'out_of_stock_products',v_out,
      'estimated_value',v_inventory_value,'alerts',v_alerts));
end;
$$;
revoke all on function public.financial_report(date,date) from public, anon;
grant execute on function public.financial_report(date,date) to authenticated;
