-- AKAPACK — Migration 0021: No. HP sales pada Surat Pesanan
-- Snapshot nomor HP sales (tampil di dokumen di bawah nama sales). Aman diulang.
alter table sales_orders add column if not exists sales_phone text;
