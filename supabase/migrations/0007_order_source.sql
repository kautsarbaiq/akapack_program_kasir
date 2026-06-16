-- ═══════════════════════════════════════════════════════════
-- AKAPACK — Migration 0007: Sumber pesanan & ongkir
-- Membedakan transaksi POS vs Online + biaya kirim.
-- Jalankan di Supabase SQL Editor → Run. Aman diulang.
-- ═══════════════════════════════════════════════════════════

alter table transactions add column if not exists source text default 'pos';        -- 'pos' | 'online'
alter table transactions add column if not exists shipping_cost numeric default 0;   -- ongkir pesanan online
