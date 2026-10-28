-- Apply once after 202610270002_expenses_reports.sql. Correct the JSON daily date type.
create or replace function public.financial_report(p_start_date date, p_end_date date)
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
    'date', d.day::date, 'revenue', coalesce(s.revenue,0), 'cogs', coalesce(s.cogs,0),
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
