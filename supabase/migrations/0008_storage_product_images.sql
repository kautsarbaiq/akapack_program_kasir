-- ═══════════════════════════════════════════════════════════
-- AKAPACK — Migration 0008: Storage foto produk
-- Bucket publik + policy agar bisa upload (mode internal) & dibaca publik.
-- Jalankan di Supabase SQL Editor → Run. Aman diulang.
-- ═══════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product-images read" on storage.objects;
create policy "product-images read" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product-images insert" on storage.objects;
create policy "product-images insert" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'product-images');

drop policy if exists "product-images update" on storage.objects;
create policy "product-images update" on storage.objects
  for update to anon, authenticated using (bucket_id = 'product-images');

-- ⚠️ Sebelum go-public: batasi insert/update hanya untuk authenticated.
