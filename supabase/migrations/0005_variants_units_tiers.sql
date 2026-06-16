-- ═══════════════════════════════════════════════════════════
-- AKAPACK — Migration 0005: Varian, Satuan Ganda, Harga Grosir
-- Skema untuk SELURUH Chunk C-2 (jalankan sekali). Aman diulang.
-- Jalankan di Supabase SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════

-- Satuan ganda & harga grosir disimpan sebagai JSON di produk:
--   units:       [{ "name": "Dus", "factor": 100, "price": 450000 }, ...]
--   price_tiers: [{ "min_qty": 10, "price": 4200 }, ...]
alter table products add column if not exists units jsonb default '[]'::jsonb;
alter table products add column if not exists price_tiers jsonb default '[]'::jsonb;
alter table products add column if not exists has_variants boolean default false;

-- Varian produk (mis. model mesin / ukuran packaging) — stok & harga per varian
create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) default '00000000-0000-0000-0000-000000000001',
  product_id uuid references products(id) on delete cascade,
  name text not null,
  sku text,
  barcode text,
  price numeric default 0,
  cost_price numeric default 0,
  stock int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_variants_product on product_variants(product_id);

-- Akses (mode internal) + RLS off, konsisten dengan 0003/0004
grant all privileges on table product_variants to anon, authenticated;
alter table product_variants disable row level security;
