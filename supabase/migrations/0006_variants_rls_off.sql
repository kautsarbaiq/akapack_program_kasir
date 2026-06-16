-- ═══════════════════════════════════════════════════════════
-- AKAPACK — Migration 0006: pastikan product_variants bisa diakses (mode internal)
-- Tabel product_variants ternyata masih RLS-on (default Supabase), insert ditolak.
-- Samakan dengan tabel lain (0004): beri akses anon + matikan RLS.
-- Jalankan di Supabase SQL Editor → Run. Aman diulang.
-- ⚠️ Sebelum go-public/SaaS: aktifkan kembali RLS + policy tenant.
-- ═══════════════════════════════════════════════════════════

grant all privileges on table product_variants to anon, authenticated;
alter table product_variants disable row level security;
