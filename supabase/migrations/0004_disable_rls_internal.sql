-- ═══════════════════════════════════════════════════════════
-- AKAPACK — Migration 0004: Nonaktifkan RLS (MODE INTERNAL)
-- Supabase mengaktifkan RLS secara default. Tanpa policy, RLS membuat
-- SELECT balik kosong & INSERT/UPDATE/DELETE ditolak via anon key.
-- Untuk mode internal (1 bisnis, belum publik) kita matikan dulu.
--
-- ⚠️ WAJIB dibalik SEBELUM go-public / SaaS multi-tenant:
--     - aktifkan kembali: alter table X enable row level security;
--     - pasang policy tenant: lihat blok contoh di 0002_tenant_pricing_audit.sql
--     - cabut akses tulis anon (0003)
-- Jalankan di Supabase SQL Editor → Run. Aman diulang.
-- ═══════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array[
    'tenants','profiles','categories','products','customers','employees',
    'shifts','transactions','transaction_items','stock_movements','promotions'
  ]
  loop
    execute format('alter table %I disable row level security', t);
  end loop;
end $$;
