-- ═══════════════════════════════════════════════════════════
-- AKAPACK — Migration 0011: Multi-Outlet (stok per cabang)
-- Tabel `inventory` (stok per outlet × produk/varian) jadi sumber kebenaran stok.
-- `products.stock` / `product_variants.stock` menjadi nilai awal (di-seed ke outlet Pusat).
-- Jalankan di Supabase SQL Editor → Run. Aman diulang.
-- ═══════════════════════════════════════════════════════════

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) default '00000000-0000-0000-0000-000000000001',
  outlet_id uuid references outlets(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  stock int default 0,
  min_stock int default 0,
  created_at timestamptz default now()
);

create index if not exists idx_inventory_outlet on inventory(outlet_id);
create index if not exists idx_inventory_product on inventory(product_id);
create index if not exists idx_inventory_variant on inventory(variant_id);

-- Cegah baris stok ganda untuk (outlet, produk, varian). variant_id NULL diperlakukan sama via sentinel.
create unique index if not exists uniq_inventory_row
  on inventory(outlet_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'));

grant all privileges on table inventory to anon, authenticated;
alter table inventory disable row level security;

-- Pastikan outlet Pusat (default) + satu cabang contoh ada
insert into outlets (id, tenant_id, name, address, is_active) values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Outlet Pusat', 'Kantor Pusat', true)
on conflict (id) do nothing;
insert into outlets (id, tenant_id, name, address, is_active) values
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Cabang 2', 'Cabang Kedua', true)
on conflict (id) do nothing;

-- Seed stok produk saat ini → outlet Pusat (idempoten: skip jika baris sudah ada)
insert into inventory (tenant_id, outlet_id, product_id, stock, min_stock)
select '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', p.id, coalesce(p.stock, 0), coalesce(p.min_stock, 0)
from products p
where not exists (
  select 1 from inventory i where i.outlet_id = '00000000-0000-0000-0000-000000000002' and i.product_id = p.id and i.variant_id is null
);

-- Seed stok varian → outlet Pusat
insert into inventory (tenant_id, outlet_id, product_id, variant_id, stock, min_stock)
select '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', v.product_id, v.id, coalesce(v.stock, 0), 0
from product_variants v
where not exists (
  select 1 from inventory i where i.outlet_id = '00000000-0000-0000-0000-000000000002' and i.variant_id = v.id
);
