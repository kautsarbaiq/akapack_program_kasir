-- ═══════════════════════════════════════════════════════════
-- AKAPACK — Migration 0003: Grant akses role API
-- Tabel yang dibuat via SQL Editor TIDAK otomatis bisa diakses anon key.
-- Migration ini memberi akses ke role 'anon' (mode internal, tanpa login)
-- dan 'authenticated' (setelah login).
--
-- ⚠️ KEAMANAN: memberi akses penuh ke 'anon' OK untuk MODE INTERNAL/DEV.
-- SEBELUM aplikasi dibuka ke publik / jadi SaaS multi-tenant:
--   1) aktifkan RLS + policy tenant (lihat 0002), DAN
--   2) cabut akses tulis 'anon': revoke all on all tables in schema public from anon;
-- Jalankan di Supabase SQL Editor → Run. Aman diulang.
-- ═══════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated;

grant all privileges on all tables in schema public to anon, authenticated;
grant all privileges on all sequences in schema public to anon, authenticated;
grant all privileges on all routines in schema public to anon, authenticated;

-- Objek yang dibuat ke depan juga otomatis dapat akses
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on routines to anon, authenticated;
