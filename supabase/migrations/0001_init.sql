-- ═══════════════════════════════════════════════════════════
-- AKAPACK — Skema Database Awal (PostgreSQL / Supabase)
-- Jalankan di Supabase Dashboard → SQL Editor → New query → Run
-- Skema ini mengikuti tipe di src/types/index.ts
-- ═══════════════════════════════════════════════════════════

-- Aktifkan ekstensi UUID
create extension if not exists "pgcrypto";

-- ─── Outlets / Toko ────────────────────────────────────────
create table if not exists outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  email text,
  logo_url text,
  tax_rate numeric default 0,
  service_charge numeric default 0,
  receipt_header text,
  receipt_footer text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ─── Kategori ──────────────────────────────────────────────
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) on delete cascade,
  name text not null,
  color text,
  icon text,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ─── Produk ────────────────────────────────────────────────
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  name text not null,
  sku text not null,
  barcode text,
  description text,
  image_url text,
  price numeric not null default 0,
  cost_price numeric not null default 0,
  stock int not null default 0,
  min_stock int not null default 0,
  unit text default 'pcs',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Pelanggan ─────────────────────────────────────────────
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  points int default 0,
  total_spent numeric default 0,
  total_transactions int default 0,
  member_since timestamptz default now(),
  created_at timestamptz default now()
);

-- ─── Karyawan ──────────────────────────────────────────────
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) on delete cascade,
  user_id uuid,                       -- relasi ke auth.users (opsional)
  name text not null,
  role text not null default 'cashier', -- owner | manager | cashier
  pin text,
  phone text,
  email text,
  avatar_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ─── Shift Kasir ───────────────────────────────────────────
create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null,
  opening_cash numeric default 0,
  closing_cash numeric,
  total_sales numeric default 0,
  total_transactions int default 0,
  status text default 'open',          -- open | closed
  opened_at timestamptz default now(),
  closed_at timestamptz
);

-- ─── Transaksi ─────────────────────────────────────────────
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) on delete cascade,
  transaction_number text not null,
  customer_id uuid references customers(id) on delete set null,
  cashier_id uuid references employees(id) on delete set null,
  shift_id uuid references shifts(id) on delete set null,
  subtotal numeric not null default 0,
  discount_amount numeric default 0,
  tax_amount numeric default 0,
  service_charge_amount numeric default 0,
  total numeric not null default 0,
  paid_amount numeric default 0,
  change_amount numeric default 0,
  payment_method text not null,        -- cash | qris | debit | credit | transfer | ewallet | split
  payment_details jsonb,
  notes text,
  status text default 'completed',     -- completed | void | refunded | pending
  created_at timestamptz default now()
);

create table if not exists transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,          -- snapshot
  product_price numeric not null,      -- snapshot
  quantity int not null,
  discount numeric default 0,
  subtotal numeric not null
);

-- ─── Pergerakan Stok ───────────────────────────────────────
create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  type text not null,                  -- in | out | adjustment | transfer | opname
  quantity int not null,
  before_stock int not null,
  after_stock int not null,
  notes text,
  reference_id uuid,
  created_by uuid,
  created_at timestamptz default now()
);

-- ─── Promosi ───────────────────────────────────────────────
create table if not exists promotions (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) on delete cascade,
  name text not null,
  type text not null,                  -- percentage | fixed | bogo | bundle
  value numeric not null default 0,
  min_purchase numeric,
  product_ids uuid[],
  category_ids uuid[],
  code text,
  max_uses int,
  used_count int default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ─── Index berguna ─────────────────────────────────────────
create index if not exists idx_products_outlet on products(outlet_id);
create index if not exists idx_products_category on products(category_id);
create index if not exists idx_transactions_outlet on transactions(outlet_id);
create index if not exists idx_transactions_created on transactions(created_at desc);
create index if not exists idx_txn_items_txn on transaction_items(transaction_id);

-- ═══════════════════════════════════════════════════════════
-- CATATAN RLS (Row Level Security)
-- Untuk MVP internal, RLS bisa dinyalakan nanti. Saat sudah ada
-- Supabase Auth, aktifkan dengan pola:
--
--   alter table products enable row level security;
--   create policy "akses outlet sendiri" on products
--     for all using ( outlet_id = (auth.jwt() ->> 'outlet_id')::uuid );
--
-- Akan dibahas detail saat integrasi Auth (Fase B).
-- ═══════════════════════════════════════════════════════════
