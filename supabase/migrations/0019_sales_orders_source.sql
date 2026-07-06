-- AKAPACK — Migration 0019: asal pesanan pada Surat Pesanan
-- Tambah No. HP asal pesanan (nomor yang chat/memesan) + staf penginput.
-- Jalankan di Supabase SQL Editor → Run. Aman diulang.
alter table sales_orders add column if not exists source_phone text;
alter table sales_orders add column if not exists created_by_name text;
