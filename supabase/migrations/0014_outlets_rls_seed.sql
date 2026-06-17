-- ═══════════════════════════════════════════════════════════
-- AKAPACK — Migration 0014: Perbaiki RLS outlets + seed outlet default
-- Migration 0011 mematikan RLS untuk `inventory` tapi LUPA tabel `outlets`,
-- sehingga insert/update outlets ditolak RLS → Nama Toko & data outlet tidak
-- pernah tersimpan (tabel outlets kosong). Aktifkan akses mode internal +
-- seed satu outlet default agar pengaturan & stok per-outlet konsisten.
-- Jalankan di Supabase SQL Editor → Run. Aman diulang.
-- ═══════════════════════════════════════════════════════════

grant all privileges on table outlets to anon, authenticated;
alter table outlets disable row level security;

-- Outlet default (id cocok dengan DEFAULT_OUTLET_ID di aplikasi + baris inventory)
insert into outlets (id, tenant_id, name, is_active)
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Akapack Kemasan',
  true
)
on conflict (id) do nothing;
