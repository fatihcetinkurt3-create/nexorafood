create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  full_name text,
  role text not null default 'owner',
  created_at timestamptz not null default now()
);

create table if not exists public.business_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  setup_completed boolean not null default false,
  whatsapp_number text,
  payment_methods jsonb not null default '["Nakit","POS","Online","IBAN"]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text not null default 'Genel',
  product_type text not null default 'sale',
  sale_price numeric not null default 0,
  purchase_price numeric not null default 0,
  stock_quantity numeric not null default 0,
  stock_unit text not null default 'Adet',
  critical_stock numeric not null default 0,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  payment_method text not null,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  total numeric not null default 0,
  cash_received numeric not null default 0,
  change_due numeric not null default 0,
  change_returned numeric not null default 0,
  tip_amount numeric not null default 0,
  custom_amount_sale boolean not null default false,
  note text,
  client_generated_id text,
  created_at timestamptz not null default now(),
  unique (business_id, client_generated_id)
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity numeric not null default 0,
  unit_price numeric not null default 0,
  total numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  movement_type text not null,
  quantity numeric not null default 0,
  unit_cost numeric not null default 0,
  total_cost numeric not null default 0,
  supplier text,
  invoice_number text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  client_generated_id text,
  created_at timestamptz not null default now(),
  unique (business_id, client_generated_id)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text,
  amount numeric not null default 0,
  payment_method text,
  expense_date date not null default current_date,
  note text,
  client_generated_id text,
  created_at timestamptz not null default now(),
  unique (business_id, client_generated_id)
);

create table if not exists public.waste_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity numeric not null default 0,
  cost numeric not null default 0,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  client_generated_id text,
  created_at timestamptz not null default now(),
  unique (business_id, client_generated_id)
);

create table if not exists public.credit_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_name text not null,
  phone text,
  balance numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  credit_account_id uuid not null references public.credit_accounts(id) on delete cascade,
  type text not null,
  amount numeric not null default 0,
  note text,
  client_generated_id text,
  created_at timestamptz not null default now(),
  unique (business_id, client_generated_id)
);

create table if not exists public.day_closings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  closing_date date not null,
  opening_cash numeric not null default 0,
  expected_cash numeric not null default 0,
  actual_cash numeric not null default 0,
  actual_pos numeric not null default 0,
  difference numeric not null default 0,
  denomination_counts jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (business_id, closing_date)
);

create table if not exists public.whatsapp_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  message_type text not null,
  recipient text not null,
  status text not null,
  response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists profiles_business_id_idx on public.profiles(business_id);
create index if not exists products_business_id_idx on public.products(business_id);
create index if not exists sales_business_id_idx on public.sales(business_id, created_at);
create index if not exists sale_items_sale_id_idx on public.sale_items(sale_id);
create index if not exists stock_movements_business_id_idx on public.stock_movements(business_id, created_at);
create index if not exists expenses_business_id_idx on public.expenses(business_id, expense_date);
create index if not exists credit_accounts_business_id_idx on public.credit_accounts(business_id);
create index if not exists credit_transactions_business_id_idx on public.credit_transactions(business_id, created_at);
create index if not exists day_closings_business_id_idx on public.day_closings(business_id, closing_date);
create index if not exists whatsapp_logs_business_id_idx on public.whatsapp_logs(business_id, created_at);

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();

drop trigger if exists business_settings_updated_at on public.business_settings;
create trigger business_settings_updated_at before update on public.business_settings for each row execute function public.set_updated_at();

create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id from public.profiles where id = auth.uid()
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_business_id uuid;
begin
  insert into public.businesses(name, owner_name, phone)
  values (
    coalesce(new.raw_user_meta_data->>'business_name', 'Nexora Food'),
    coalesce(new.raw_user_meta_data->>'owner_name', new.email),
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  returning id into new_business_id;

  insert into public.profiles(id, business_id, full_name, role)
  values (
    new.id,
    new_business_id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'owner_name', new.email),
    'owner'
  );

  insert into public.business_settings(business_id, setup_completed, whatsapp_number)
  values (new_business_id, false, coalesce(new.raw_user_meta_data->>'phone', ''));

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.business_settings enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.expenses enable row level security;
alter table public.waste_records enable row level security;
alter table public.credit_accounts enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.day_closings enable row level security;
alter table public.whatsapp_logs enable row level security;

create policy "profiles read own" on public.profiles for select using (id = auth.uid());
create policy "profiles update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "business read own" on public.businesses for select using (id = public.current_business_id());
create policy "business update own" on public.businesses for update using (id = public.current_business_id()) with check (id = public.current_business_id());

create policy "settings own all" on public.business_settings for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "products own all" on public.products for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "sales own all" on public.sales for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "sale items own all" on public.sale_items for all
  using (exists (select 1 from public.sales s where s.id = sale_id and s.business_id = public.current_business_id()))
  with check (exists (select 1 from public.sales s where s.id = sale_id and s.business_id = public.current_business_id()));

create policy "stock movements own all" on public.stock_movements for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "expenses own all" on public.expenses for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "waste own all" on public.waste_records for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "credit accounts own all" on public.credit_accounts for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "credit transactions own all" on public.credit_transactions for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "day closings own all" on public.day_closings for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "whatsapp logs own all" on public.whatsapp_logs for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());
