-- ═══════════════════════════════════════════════════════════
-- AKAPACK — Migration 0022: Quotation / Surat Penawaran Harga
-- Dokumen penawaran ke customer (header + item). BUKAN pergerakan stok.
-- Jalankan di Supabase SQL Editor → Run. Aman diulang.
-- ═══════════════════════════════════════════════════════════

create table if not exists quotations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) default '00000000-0000-0000-0000-000000000001',
  number text not null,                       -- QTN-xxxx/DDMMYYYY
  outlet_id uuid references outlets(id),
  customer_name text not null,
  customer_address text,                      -- baris di bawah nama ("Di Tempat" bila kosong)
  quote_date timestamptz not null default now(),
  total numeric default 0,
  terms text,                                 -- catatan/bullet (mis. "Harga belum termasuk pajak")
  bank_info text,                             -- "Pembayaran Transfer : BCA a.n. ... 8090488458"
  created_by_name text,                       -- penandatangan (mis. Salma)
  status text default 'draft' check (status in ('draft','sent','accepted','rejected')),
  created_at timestamptz default now()
);

create table if not exists quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid references quotations(id) on delete cascade,
  product_id uuid references products(id),
  description text not null,                  -- Keterangan (nama barang)
  unit_price numeric default 0,               -- harga nego per unit
  qty numeric default 0,
  total numeric default 0
);

create index if not exists idx_quotations_outlet on quotations(outlet_id);
create index if not exists idx_quotationitems_doc on quotation_items(quotation_id);
create unique index if not exists idx_quotations_number on quotations(tenant_id, number);

grant all privileges on table quotations to anon, authenticated;
grant all privileges on table quotation_items to anon, authenticated;
alter table quotations disable row level security;
alter table quotation_items disable row level security;
