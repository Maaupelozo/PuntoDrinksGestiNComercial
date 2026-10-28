-- Apply once after 202610270003_financial_daily_date.sql.
-- Per-user business preferences. No privileged browser function is required.
create table public.business_settings (
  owner_id uuid primary key references auth.users(id) on delete restrict,
  business_name text not null default 'Punto Drinks'
    check (length(pg_catalog.btrim(business_name)) between 1 and 160),
  phone text check (phone is null or length(phone) <= 50),
  address text check (address is null or length(address) <= 300),
  currency text not null default 'ARS' check (currency = 'ARS'),
  time_zone text not null default 'America/Argentina/Cordoba'
    check (time_zone = 'America/Argentina/Cordoba'),
  default_min_stock integer not null default 0
    check (default_min_stock between 0 and 1000000),
  logo_url text check (logo_url is null or
    (length(logo_url) <= 2048 and logo_url ~ '^https://[^[:space:]]+$')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);
create trigger business_settings_touch_timestamp before update on public.business_settings
for each row execute function private.touch_product_timestamp();
alter table public.business_settings enable row level security;
create policy business_settings_select_own on public.business_settings
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy business_settings_insert_own on public.business_settings
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy business_settings_update_own on public.business_settings
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
revoke all on public.business_settings from public, anon, authenticated;
grant select, insert on public.business_settings to authenticated;
grant update (business_name, phone, address, default_min_stock, logo_url)
  on public.business_settings to authenticated;
