-- ═══════════════════════════════════════════════════════════
-- AKAPACK — Migration 0013: Stok Keluar (dokumen pengeluaran stok)
-- Dokumen pengeluaran stok (header + item) sejajar dengan Pembelian.
-- Posting dokumen → stok berkurang (di app via stock_movements) untuk
-- alasan: rusak, hilang, pemakaian, retur supplier, penyesuaian, dll.
-- Jalankan di Supabase SQL Editor → Run. Aman diulang.
-- ═══════════════════════════════════════════════════════════

create table if not exists stock_outs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) default '00000000-0000-0000-0000-000000000001',
  number text not null,
  outlet_id uuid references outlets(id),
  reason text default 'lainnya' check (reason in ('rusak','hilang','pemakaian','retur','penyesuaian','lainnya')),
  total numeric default 0,
  total_qty numeric default 0,
  status text default 'draft' check (status in ('draft','posted','cancelled')),
  notes text,
  date timestamptz not null default now(),
  posted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists stock_out_items (
  id uuid primary key default gen_random_uuid(),
  stock_out_id uuid references stock_outs(id) on delete cascade,
  product_id uuid references products(id),
  product_name text not null,
  qty numeric default 0,
  cost numeric default 0,
  subtotal numeric default 0
);

create index if not exists idx_stockouts_outlet on stock_outs(outlet_id);
create index if not exists idx_stockoutitems_doc on stock_out_items(stock_out_id);

-- Akses (mode internal) + RLS off, konsisten dengan 0003/0004/0009/0010
grant all privileges on table stock_outs to anon, authenticated;
grant all privileges on table stock_out_items to anon, authenticated;
alter table stock_outs disable row level security;
alter table stock_out_items disable row level security;
