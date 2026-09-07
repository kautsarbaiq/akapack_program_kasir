-- Stok hilang saat dua perangkat menulis bersamaan (lost update).
-- Dulu klien menghitung `stok_baru = stok_di_memori + delta` lalu MENIMPA kolom stock dengan angka
-- absolut. Kalau perangkat lain sudah mengubah stok, angka di memori sudah basi → perubahan orang
-- lain terhapus. Kejadian nyata 17 Agu 2026 (Brown Paper Cup 8oz, cabang Bandung):
--   02:58 penjualan  4775 → 4725
--   05:13 transfer   4775 → 2775   (pakai angka basi 4775, bukan 4725)
--   06:12 penjualan  4725 → 4700   (transfer -2000 TERHAPUS)
--
-- Perbaikan: penambahan/pengurangan dikerjakan DI DATABASE (stock = stock + delta) dengan baris
-- dikunci, jadi urutannya selalu benar walau 3 kasir + owner menulis pada detik yang sama.
create or replace function public.apply_stock_delta(
  p_outlet  uuid,
  p_product uuid,
  p_variant uuid,
  p_delta   integer
)
returns table (before_stock integer, after_stock integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_before integer;
  v_after  integer;
  v_nil    constant uuid := '00000000-0000-0000-0000-000000000000';
begin
  -- Kunci baris (FOR UPDATE): penulis lain menunggu, bukan saling menimpa.
  select id, stock into v_id, v_before
    from public.inventory
   where outlet_id = p_outlet
     and product_id = p_product
     and coalesce(variant_id, v_nil) = coalesce(p_variant, v_nil)
   for update;

  if v_id is null then
    -- Belum ada baris stok untuk kombinasi ini → buat, aman terhadap balapan.
    insert into public.inventory (tenant_id, outlet_id, product_id, variant_id, stock, min_stock)
    values ('00000000-0000-0000-0000-000000000001', p_outlet, p_product, p_variant, p_delta, 0)
    on conflict (outlet_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
      do update set stock = public.inventory.stock + p_delta
    returning stock into v_after;
    v_before := v_after - p_delta;
  else
    update public.inventory set stock = stock + p_delta where id = v_id
    returning stock into v_after;
  end if;

  return query select v_before, v_after;
end;
$$;

grant execute on function public.apply_stock_delta(uuid, uuid, uuid, integer) to anon, authenticated;
