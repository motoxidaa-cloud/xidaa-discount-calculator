-- ============================================================================
-- Xidaa Discount Calculator — production database schema
-- Supabase PostgreSQL. Apply in the Supabase SQL Editor or via:
--   npm run db:migrate
--
-- NOTE: No login system. Access control is handled at the app/role level;
-- the database is protected by the Supabase project's network-level security.
-- Row Level Security is intentionally not applied (internal single-team tool).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Customers / dealers
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  city text,
  dealer_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, phone)
);

-- ---------------------------------------------------------------------------
-- 2. Orders
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  customer_name text not null,
  customer_phone text,
  city text,
  status text not null default 'saved' check (status in ('draft', 'saved', 'approved')),
  notes text,
  -- summary columns (mirror the calculation snapshot for fast queries)
  total_scooters int not null default 0,
  dl_qty int not null default 0,
  other_qty int not null default 0,
  battery_qty int not null default 0,
  distance_km numeric(8,2) not null default 0,
  base_transport_paise bigint not null default 0,
  surcharge_paise bigint not null default 0,
  transport_subtotal_paise bigint not null default 0,
  transport_gst_paise bigint not null default 0,
  final_transport_paise bigint not null default 0,
  scooter_discount_allowance_paise bigint not null default 0,
  battery_discount_paise bigint not null default 0,
  selected_option_key text,
  recommended_key text,
  profit_verified boolean not null default false,
  snapshot jsonb not null,
  created_by text,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_ref_idx on public.orders (ref);
create index if not exists orders_customer_idx on public.orders (customer_name);
create index if not exists orders_created_idx on public.orders (created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Order scooter items (snapshot per item)
-- ---------------------------------------------------------------------------
create table if not exists public.order_scooter_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  model_id text not null,
  model_name text not null,
  category text not null check (category in ('DL', 'Other')),
  qty int not null check (qty > 0),
  unit_price_paise bigint,
  unit_cost_paise bigint,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists osi_order_idx on public.order_scooter_items (order_id);

-- ---------------------------------------------------------------------------
-- 4. Order battery items
-- ---------------------------------------------------------------------------
create table if not exists public.order_battery_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id text not null,
  variant_name text not null,
  capacity_ah int,
  qty int not null check (qty > 0),
  eligible boolean not null default true,
  unit_price_paise bigint,
  unit_cost_paise bigint,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists obi_order_idx on public.order_battery_items (order_id);

-- ---------------------------------------------------------------------------
-- 5. Truck allocations (per order, per truck)
-- ---------------------------------------------------------------------------
create table if not exists public.truck_allocations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  truck_config_id text not null,
  label text not null,
  capacity int not null,
  rate_per_km_paise bigint not null,
  count int not null check (count > 0),
  distance_km numeric(8,2) not null default 0,
  base_paise bigint not null default 0,
  surcharge_paise bigint not null default 0,
  subtotal_paise bigint not null default 0,
  gst_paise bigint not null default 0,
  total_paise bigint not null default 0,
  sort int not null default 0
);
create index if not exists ta_order_idx on public.truck_allocations (order_id);

-- ---------------------------------------------------------------------------
-- 6. Discount eligibility results (one row per option, per order)
-- ---------------------------------------------------------------------------
create table if not exists public.discount_options (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  option_key text not null,
  eligible boolean not null,
  ineligible_reason text,
  shortfall_paise bigint,
  scooter_discount_paise bigint not null default 0,
  company_support_paise bigint not null default 0,
  dealer_transport_paise bigint not null default 0,
  battery_discount_paise bigint not null default 0,
  profit_status text not null,
  data jsonb not null default '{}'::jsonb,
  sort int not null default 0,
  unique (order_id, option_key)
);
create index if not exists do_order_idx on public.discount_options (order_id);

-- ---------------------------------------------------------------------------
-- 7. Discount recommendation snapshots
-- ---------------------------------------------------------------------------
create table if not exists public.discount_recommendations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  recommended_key text,
  provisional boolean not null default false,
  rationale text,
  created_at timestamptz not null default now(),
  unique (order_id)
);
create index if not exists dr_order_idx on public.discount_recommendations (order_id);

-- ---------------------------------------------------------------------------
-- 8. Profitability snapshots (one row per option, per order)
-- ---------------------------------------------------------------------------
create table if not exists public.profitability_snapshots (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  option_key text not null,
  verified boolean not null default false,
  missing_data jsonb not null default '[]'::jsonb,
  revenue_total_paise bigint not null default 0,
  scooter_revenue_paise bigint not null default 0,
  battery_revenue_paise bigint not null default 0,
  transport_collected_ex_gst_paise bigint not null default 0,
  cost_total_paise bigint not null default 0,
  scooter_cost_paise bigint not null default 0,
  battery_cost_paise bigint not null default 0,
  company_transport_expense_paise bigint not null default 0,
  other_expenses_paise bigint not null default 0,
  profit_paise bigint not null default 0,
  margin_pct numeric(6,2) not null default 0,
  meets_minimum boolean not null default false,
  below_by_paise bigint not null default 0,
  unique (order_id, option_key)
);
create index if not exists ps_order_idx on public.profitability_snapshots (order_id);

-- ---------------------------------------------------------------------------
-- 9. Model catalogue (approved prices & costs, admin-managed)
-- ---------------------------------------------------------------------------
create table if not exists public.model_catalog (
  id text primary key,
  name text not null,
  category text not null default 'Other' check (category in ('DL', 'Other')),
  approved_price_paise bigint,
  cost_paise bigint,
  active boolean not null default true,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 10. Battery catalogue
-- ---------------------------------------------------------------------------
create table if not exists public.battery_catalog (
  id text primary key,
  name text not null,
  capacity_ah int,
  tech text,
  approved_price_paise bigint,
  cost_paise bigint,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 11. App settings (single row)
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 12. Audit logs
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id text,
  actor_name text,
  action text not null,
  entity text not null,
  details text,
  created_at timestamptz not null default now()
);
create index if not exists audit_created_idx on public.audit_logs (created_at desc);

-- ============================================================================
-- Seed reference data
-- ============================================================================
insert into public.model_catalog (id, name, category, approved_price_paise, cost_paise, active, sort_order) values
  ('x-single-light', 'X-Single Light', 'Other', null, null, true, 0),
  ('x-double-light', 'X-Double Light', 'Other', null, null, true, 1),
  ('x-torvo', 'X-Torvo', 'Other', null, null, true, 2),
  ('x-e4', 'X-E4', 'Other', null, null, true, 3),
  ('x-fh-big-activa', 'X-FH (Big Activa)', 'Other', null, null, true, 4),
  ('x-ozone', 'X-Ozone', 'Other', null, null, true, 5),
  ('x-cs3', 'X-CS3', 'Other', null, null, true, 6),
  ('x-orl-cheetah', 'X-ORL Cheetah', 'Other', null, null, true, 7),
  ('x-robox', 'X-Robox', 'Other', null, null, true, 8),
  ('x-ambretta', 'X-Ambretta', 'Other', null, null, true, 9),
  ('x-tank', 'X-Tank', 'Other', null, null, true, 10),
  ('x-yokozuna', 'X-Yokozuna', 'Other', null, null, true, 11),
  ('x-boston', 'X-Boston', 'Other', null, null, true, 12),
  ('x-pro', 'X-Pro', 'Other', null, null, true, 13),
  ('x-act', 'X-Act', 'Other', null, null, true, 14),
  ('x-oki', 'X-Oki', 'Other', null, null, true, 15),
  ('x-b-act', 'X-B.Act', 'Other', null, null, true, 16),
  ('x-goddess', 'X-Goddess', 'Other', null, null, true, 17),
  ('x-beta', 'X-Beta', 'Other', null, null, true, 18),
  ('x-load-master', 'X-Load Master', 'Other', null, null, true, 19),
  ('x-3-wheel-load-master', 'X-3 Wheel Load Master', 'Other', null, null, true, 20),
  ('x-3-wheeler-handicapped', 'X-3 Wheeler (Handicapped)', 'Other', null, null, true, 21),
  ('x-l5', 'X-L5 (Export)', 'Other', null, null, true, 22)
on conflict (id) do nothing;

insert into public.battery_catalog (id, name, capacity_ah, tech, approved_price_paise, cost_paise, active) values
  ('battery-60-30-lfp', '60V / 30Ah LFP', 30, 'LFP', null, null, true),
  ('battery-60-45-lfp', '60V / 45Ah LFP', 45, 'LFP', null, null, true),
  ('battery-60-55-pouch', '60V / 55Ah Pouch Cell', 55, 'Pouch Cell', null, null, true)
on conflict (id) do nothing;

-- Default settings (₹ amounts stored as paise)
insert into public.app_settings (id, data) values (1, '{
  "discounts": {
    "dlDiscountPaise": 50000,
    "otherDiscountPaise": 100000,
    "batteryDiscountPaise": 50000,
    "transportSupportPercent": 50,
    "fallbackPreference": "scooter_discount"
  },
  "transport": {
    "trucks": [
      {"id": "truck-12", "label": "12-scooter truck", "capacity": 12, "ratePerKmPaise": 4000, "active": true},
      {"id": "truck-32", "label": "32-scooter truck", "capacity": 32, "ratePerKmPaise": 5500, "active": true},
      {"id": "truck-55", "label": "55-scooter truck", "capacity": 55, "ratePerKmPaise": 6500, "active": true}
    ],
    "surchargePercent": 10,
    "gstPercent": 5
  },
  "profit": {
    "minProfitMode": "amount",
    "minProfitAmountPaise": 1500000,
    "minProfitMarginPercent": 5,
    "companyExpensesPaise": 0,
    "gstRecoverable": true
  }
}'::jsonb)
on conflict (id) do nothing;
