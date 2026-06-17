-- ═══════════════════════════════════════════════════════════
-- AKAPACK — Migration 0010: Pembelian & Supplier
-- Supplier + Purchase Order (header + item). Terima PO → stok bertambah
-- (di app via stock_movements) + jurnal otomatis (Persediaan ↔ Hutang/Kas).
-- Jalankan di Supabase SQL Editor → Run. Aman diulang.
-- ═══════════════════════════════════════════════════════════

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) default '00000000-0000-0000-0000-000000000001',
  name text not null,
  phone text,
  email text,
  address text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) default '00000000-0000-0000-0000-000000000001',
  number text not null,
  supplier_id uuid references suppliers(id),
  total numeric default 0,
  status text default 'draft' check (status in ('draft','ordered','received','cancelled')),
  payment text default 'credit' check (payment in ('cash','transfer','credit')),
  paid boolean default false,
  paid_at timestamptz,
  notes text,
  date timestamptz not null default now(),
  received_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid references purchase_orders(id) on delete cascade,
  product_id uuid references products(id),
  product_name text not null,
  qty numeric default 0,
  cost numeric default 0,
  subtotal numeric default 0
);

create index if not exists idx_po_supplier on purchase_orders(supplier_id);
create index if not exists idx_poitems_po on purchase_order_items(purchase_id);

-- Akses (mode internal) + RLS off, konsisten dengan 0003/0004/0009
grant all privileges on table suppliers to anon, authenticated;
grant all privileges on table purchase_orders to anon, authenticated;
grant all privileges on table purchase_order_items to anon, authenticated;
alter table suppliers disable row level security;
alter table purchase_orders disable row level security;
alter table purchase_order_items disable row level security;
