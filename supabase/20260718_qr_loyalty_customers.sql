-- Nexora Food AI - QR tabanli musteri sadakat sistemi
-- Supabase SQL Editor'da tek seferde calistirilabilir.

create extension if not exists "pgcrypto";

do $$
declare
  has_businesses boolean;
  has_customers boolean;
  has_customers_id boolean;
  has_sales boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'businesses'
  ) into has_businesses;

  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'customers'
  ) into has_customers;

  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'sales'
  ) into has_sales;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'id'
  ) into has_customers_id;

  if not has_customers then
    if has_businesses then
      execute $sql$
        create table public.customers (
          id uuid primary key default gen_random_uuid(),
          business_id uuid not null references public.businesses(id) on delete cascade,
          full_name text not null,
          phone text not null,
          customer_code text not null,
          points integer not null default 0,
          total_points integer not null default 0,
          rewards_earned integer not null default 0,
          rewards_redeemed integer not null default 0,
          total_purchases integer not null default 0,
          last_purchase_at timestamptz,
          kvkk_accepted boolean not null default false,
          campaign_opt_in boolean not null default false,
          qr_created_at timestamptz not null default now(),
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (business_id, phone),
          unique (customer_code)
        )
      $sql$;
    else
      execute $sql$
        create table public.customers (
          id uuid primary key default gen_random_uuid(),
          business_id uuid,
          full_name text not null,
          phone text not null,
          customer_code text not null,
          points integer not null default 0,
          total_points integer not null default 0,
          rewards_earned integer not null default 0,
          rewards_redeemed integer not null default 0,
          total_purchases integer not null default 0,
          last_purchase_at timestamptz,
          kvkk_accepted boolean not null default false,
          campaign_opt_in boolean not null default false,
          qr_created_at timestamptz not null default now(),
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (customer_code)
        )
      $sql$;
    end if;
  else
    alter table public.customers add column if not exists customer_code text;
    alter table public.customers add column if not exists qr_created_at timestamptz not null default now();
    alter table public.customers add column if not exists full_name text;
    alter table public.customers add column if not exists phone text;
    alter table public.customers add column if not exists points integer not null default 0;
    alter table public.customers add column if not exists total_points integer not null default 0;
    alter table public.customers add column if not exists rewards_earned integer not null default 0;
    alter table public.customers add column if not exists rewards_redeemed integer not null default 0;
    alter table public.customers add column if not exists total_purchases integer not null default 0;
    alter table public.customers add column if not exists last_purchase_at timestamptz;
    alter table public.customers add column if not exists kvkk_accepted boolean not null default false;
    alter table public.customers add column if not exists campaign_opt_in boolean not null default false;
    alter table public.customers add column if not exists updated_at timestamptz not null default now();
  end if;

  if has_customers_id then
    execute $sql$
      update public.customers
      set customer_code = 'NXR-' || upper(substr(md5(coalesce(id::text, gen_random_uuid()::text)), 1, 6))
      where customer_code is null or customer_code = ''
    $sql$;
  else
    update public.customers
    set customer_code = 'NXR-' || upper(substr(md5(gen_random_uuid()::text), 1, 6))
    where customer_code is null or customer_code = '';
  end if;

  alter table public.customers alter column customer_code set not null;

  if has_sales then
    alter table public.sales add column if not exists customer_code text;
    alter table public.sales add column if not exists loyalty_points_earned integer not null default 0;
    alter table public.sales add column if not exists loyalty_reward_redeemed boolean not null default false;
  end if;
end $$;

create unique index if not exists customers_customer_code_unique_idx
  on public.customers(customer_code);

create index if not exists customers_business_phone_idx
  on public.customers(business_id, phone);

create index if not exists customers_business_code_idx
  on public.customers(business_id, customer_code);

alter table public.customers enable row level security;

do $$
declare
  has_profiles_business boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'business_id'
  ) into has_profiles_business;

  if has_profiles_business then
    drop policy if exists customers_business_select on public.customers;
    drop policy if exists customers_business_insert on public.customers;
    drop policy if exists customers_business_update on public.customers;
    drop policy if exists customers_business_delete on public.customers;

    create policy customers_business_select on public.customers
      for select using (business_id in (select business_id from public.profiles where id = auth.uid()));

    create policy customers_business_insert on public.customers
      for insert with check (business_id in (select business_id from public.profiles where id = auth.uid()));

    create policy customers_business_update on public.customers
      for update using (business_id in (select business_id from public.profiles where id = auth.uid()))
      with check (business_id in (select business_id from public.profiles where id = auth.uid()));

    create policy customers_business_delete on public.customers
      for delete using (business_id in (select business_id from public.profiles where id = auth.uid()));
  end if;
end $$;
