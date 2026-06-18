-- ═══════════════════════════════════════════════════════════
-- AKAPACK — Migration 0015: Field tambahan Stok Masuk
-- Halaman Pembelian dijadikan "Stok Masuk" (gaya Olsera): tambah
-- "Diterima dari" (received_from) & "Diterima Oleh" (received_by).
-- Jalankan di Supabase SQL Editor → Run. Aman diulang.
-- ═══════════════════════════════════════════════════════════

alter table purchase_orders add column if not exists received_from text;
alter table purchase_orders add column if not exists received_by text;
