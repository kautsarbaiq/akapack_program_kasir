-- ═══════════════════════════════════════════════════════════
-- AKAPACK — Migration 0018: Surat Pesanan (sales order / order letter)
-- Dokumen pesanan pelanggan (header + item) yang dibuat oleh SALES.
-- BUKAN pergerakan stok — tidak menambah/mengurangi stok sama sekali.
-- Jalankan di Supabase SQL Editor → Run. Aman diulang.
-- ═══════════════════════════════════════════════════════════

create table if not exists sales_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) default '00000000-0000-0000-0000-000000000001',
  number text not null,                       -- No. PO / SP (SP-YYYYMMDD-xxx)
  outlet_id uuid references outlets(id),
  customer_name text not null,
  customer_address text,
  customer_phone text,
  order_date timestamptz not null default now(),
  sales_name text,
  sales_id uuid references employees(id),
  bank_name text,                             -- nama bank
  bank_ref text,                              -- no. ref / rekening bank
  shipping_cost numeric default 0,            -- ongkir
  subtotal numeric default 0,                 -- total item sebelum ongkir
  total numeric default 0,                    -- subtotal + ongkir
  status text default 'draft' check (status in ('draft','confirmed','done','cancelled')),
  notes text,
  created_at timestamptz default now()
);

create table if not exists sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid references sales_orders(id) on delete cascade,
  product_id uuid references products(id),
  product_name text not null,
  qty numeric default 0,
  price numeric default 0,                    -- harga jual per unit
  subtotal numeric default 0
);

create index if not exists idx_salesorders_outlet on sales_orders(outlet_id);
create index if not exists idx_salesorders_customer on sales_orders(customer_name);
create index if not exists idx_salesorderitems_doc on sales_order_items(sales_order_id);
-- No. SP unik per tenant → cegah duplikat nomor saat 2 device buat bersamaan (silent → error).
create unique index if not exists idx_salesorders_number on sales_orders(tenant_id, number);

-- Akses (mode internal) + RLS off, konsisten dengan 0003/0004/0009/0010/0013
grant all privileges on table sales_orders to anon, authenticated;
grant all privileges on table sales_order_items to anon, authenticated;
alter table sales_orders disable row level security;
alter table sales_order_items disable row level security;
