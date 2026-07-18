-- Nexora Food AI - Hammadde + Recete sistemi
-- Supabase SQL Editor'da tek parca olarak calistirilabilir.

create extension if not exists "pgcrypto";

alter table public.products
  add column if not exists stock_tracking_type text not null default 'none'
    check (stock_tracking_type in ('ready_product', 'recipe', 'none', 'ingredient')),
  add column if not exists variable_weight_enabled boolean not null default false;

update public.products
set stock_tracking_type = case
  when product_type = 'raw' then 'ingredient'
  when coalesce(stock_quantity, 0) > 0
    and (
      lower(coalesce(category, '')) like '%icecek%'
      or lower(coalesce(category, '')) like '%içecek%'
      or lower(coalesce(name, '')) similar to '%(ayran|kola|su|salgam|şalgam|soda|meyve suyu|dondurma)%'
    )
    then 'ready_product'
  else stock_tracking_type
end
where stock_tracking_type = 'none';

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  stock_quantity numeric(14, 3) not null default 0,
  unit text not null check (unit in ('Kg', 'Gram', 'Adet')),
  critical_stock numeric(14, 3) not null default 0,
  unit_cost numeric(14, 4) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name)
);

create table if not exists public.product_recipes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric(14, 3) not null check (quantity > 0),
  unit text not null check (unit in ('gram', 'kilogram', 'adet')),
  created_at timestamptz not null default now(),
  unique (business_id, product_id, ingredient_id)
);

create table if not exists public.ingredient_stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  movement_type text not null check (movement_type in ('stok_girisi', 'satis', 'satis_iptali', 'duzeltme', 'fire')),
  quantity numeric(14, 3) not null,
  previous_stock numeric(14, 3) not null,
  new_stock numeric(14, 3) not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

alter table public.stock_movements
  add column if not exists sale_id uuid references public.sales(id) on delete set null;

alter table public.sales
  add column if not exists status text not null default 'active',
  add column if not exists stock_applied boolean not null default false,
  add column if not exists stock_movements_reversed boolean not null default false,
  add column if not exists cancelled_at timestamptz;

create index if not exists ingredients_business_idx on public.ingredients(business_id);
create index if not exists product_recipes_business_product_idx on public.product_recipes(business_id, product_id);
create index if not exists ingredient_stock_movements_business_idx on public.ingredient_stock_movements(business_id, created_at desc);

alter table public.ingredients enable row level security;
alter table public.product_recipes enable row level security;
alter table public.ingredient_stock_movements enable row level security;

drop policy if exists ingredients_business_select on public.ingredients;
drop policy if exists ingredients_business_insert on public.ingredients;
drop policy if exists ingredients_business_update on public.ingredients;
drop policy if exists ingredients_business_delete on public.ingredients;
drop policy if exists product_recipes_business_select on public.product_recipes;
drop policy if exists product_recipes_business_insert on public.product_recipes;
drop policy if exists product_recipes_business_update on public.product_recipes;
drop policy if exists product_recipes_business_delete on public.product_recipes;
drop policy if exists ingredient_movements_business_select on public.ingredient_stock_movements;
drop policy if exists ingredient_movements_business_insert on public.ingredient_stock_movements;
drop policy if exists ingredient_movements_business_update on public.ingredient_stock_movements;
drop policy if exists ingredient_movements_business_delete on public.ingredient_stock_movements;

create policy ingredients_business_select on public.ingredients
  for select using (business_id in (select business_id from public.profiles where id = auth.uid()));
create policy ingredients_business_insert on public.ingredients
  for insert with check (business_id in (select business_id from public.profiles where id = auth.uid()));
create policy ingredients_business_update on public.ingredients
  for update using (business_id in (select business_id from public.profiles where id = auth.uid()))
  with check (business_id in (select business_id from public.profiles where id = auth.uid()));
create policy ingredients_business_delete on public.ingredients
  for delete using (business_id in (select business_id from public.profiles where id = auth.uid()));

create policy product_recipes_business_select on public.product_recipes
  for select using (business_id in (select business_id from public.profiles where id = auth.uid()));
create policy product_recipes_business_insert on public.product_recipes
  for insert with check (business_id in (select business_id from public.profiles where id = auth.uid()));
create policy product_recipes_business_update on public.product_recipes
  for update using (business_id in (select business_id from public.profiles where id = auth.uid()))
  with check (business_id in (select business_id from public.profiles where id = auth.uid()));
create policy product_recipes_business_delete on public.product_recipes
  for delete using (business_id in (select business_id from public.profiles where id = auth.uid()));

create policy ingredient_movements_business_select on public.ingredient_stock_movements
  for select using (business_id in (select business_id from public.profiles where id = auth.uid()));
create policy ingredient_movements_business_insert on public.ingredient_stock_movements
  for insert with check (business_id in (select business_id from public.profiles where id = auth.uid()));
create policy ingredient_movements_business_update on public.ingredient_stock_movements
  for update using (business_id in (select business_id from public.profiles where id = auth.uid()))
  with check (business_id in (select business_id from public.profiles where id = auth.uid()));
create policy ingredient_movements_business_delete on public.ingredient_stock_movements
  for delete using (business_id in (select business_id from public.profiles where id = auth.uid()));
