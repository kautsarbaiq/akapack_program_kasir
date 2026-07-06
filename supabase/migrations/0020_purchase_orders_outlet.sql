-- AKAPACK — Migration 0020: cabang pada dokumen Stok Masuk
-- Kolom outlet_id purchase_orders (sudah dijalankan manual di produksi Jul 2026;
-- file ini melengkapinya untuk instalasi baru). Aman diulang.
alter table purchase_orders add column if not exists outlet_id uuid references outlets(id);
create index if not exists idx_po_outlet on purchase_orders(outlet_id);
