-- 0025: dua celah dari review adversarial atas 0024.
--
-- 1) Produk/varian yang sudah dihapus menggagalkan SELURUH nota (23503) → potongan stok semua barang
--    lain di nota itu hilang & nota macet di antrean kasir selamanya. Kini baris itu saja yang dilewati.
-- 2) Void dipaksa ("nota tak punya jejak stok") bisa terjadi saat potongan stoknya masih di antrean
--    kasir; potongan yang datang belakangan lalu memotong stok untuk penjualan yang sudah batal dan
--    tak pernah dikembalikan. Kini potongan 'out' untuk nota berstatus void dicatat 0.
--
-- Tanda tangan & tipe kembalian SAMA dengan 0024 → CREATE OR REPLACE aman; aplikasi tak perlu diubah.

create or replace function public.apply_stock_movement(
  p_movement_id    uuid,                 -- kunci idempoten dari klien (crypto.randomUUID / turunan deterministik)
  p_outlet         uuid,
  p_product        uuid,
  p_variant        uuid,                 -- null = baris level produk
  p_delta          integer,              -- perubahan bertanda, SATUAN DASAR (qty x faktor). Diabaikan bila p_set_to diisi.
  p_type           text,                 -- in | out | adjustment | transfer | opname
  p_notes          text        default null,
  p_reference_id   uuid        default null,
  p_created_at     timestamptz default null,  -- waktu kejadian (klien); null/masa depan -> now()
  p_set_to         integer     default null,  -- angka absolut (opname/SO/ubah dari form); delta dihitung DI SINI di bawah kunci
  p_allow_negative boolean     default true,  -- false untuk transfer keluar / stok keluar: tolak bila hasil < 0
  p_expect_before  integer     default null   -- kontrol konkurensi optimis: tolak bila stok server != angka yang dilihat user
)
returns table (movement_id uuid, before_stock integer, after_stock integer, quantity integer, applied boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_old    public.stock_movements%rowtype;
  v_inv_id uuid;
  v_before integer;
  v_after  integer;
  v_qty    integer;
  v_txn_status text;
begin
  -- ── Validasi
  if p_movement_id is null or p_outlet is null or p_product is null then
    raise exception 'movement_id, outlet, dan product wajib diisi' using errcode = '22004';
  end if;
  if p_type is null or p_type not in ('in', 'out', 'adjustment', 'transfer', 'opname') then
    raise exception 'type tidak valid: %', p_type using errcode = '22023';
  end if;
  if p_set_to is null and coalesce(p_delta, 0) = 0 then
    raise exception 'delta kosong/0 tanpa set_to' using errcode = '22023';
  end if;
  if p_set_to is not null and p_set_to < 0 then
    raise exception 'set_to tidak boleh minus (%)', p_set_to using errcode = '22023';
  end if;
  -- Produk / varian sudah DIHAPUS (kasir masih memegang katalog lama, atau antrean offline): lewati
  -- baris ini saja, JANGAN gagalkan seluruh nota. Dulu 23503 membatalkan semua baris → potongan stok
  -- barang lain di nota yang sama ikut hilang. applied=false + angka 0 = "tidak diterapkan".
  if not exists (select 1 from public.products p where p.id = p_product)
     or (p_variant is not null and not exists (
           select 1 from public.product_variants pv where pv.id = p_variant and pv.product_id = p_product)) then
    return query select p_movement_id, 0, 0, 0, false;
    return;
  end if;

  -- Potongan PENJUALAN untuk nota yang SUDAH DI-VOID (void dipaksa saat potongannya masih di antrean
  -- kasir): kunci notanya dulu (urutan kunci sama dgn void_sale_with_stock: nota → stok, anti-deadlock)
  -- lalu catat sebagai 0 — stok TIDAK dipotong untuk penjualan yang sudah dibatalkan.
  if p_type = 'out' and p_reference_id is not null then
    select t.status into v_txn_status from public.transactions t where t.id = p_reference_id for share;
  end if;

  -- ── 1. Kunci baris stok (buat dulu bila belum ada). Semua penulis baris ini antre di sini,
  --       termasuk panggilan ulang dengan id yang sama, jadi cek idempoten di bawah selalu akurat.
  select i.id, coalesce(i.stock, 0) into v_inv_id, v_before
    from public.inventory i
   where i.outlet_id = p_outlet and i.product_id = p_product
     and coalesce(i.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
       = coalesce(p_variant,   '00000000-0000-0000-0000-000000000000'::uuid)
     for update;
  if v_inv_id is null then
    -- Target ON CONFLICT harus PERSIS ekspresi indeks uniq_inventory_row (literal, bukan variabel).
    insert into public.inventory (tenant_id, outlet_id, product_id, variant_id, stock, min_stock)
    values ('00000000-0000-0000-0000-000000000001', p_outlet, p_product, p_variant, 0, 0)
    on conflict (outlet_id, product_id, (coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)))
    do nothing;
    select i.id, coalesce(i.stock, 0) into v_inv_id, v_before
      from public.inventory i
     where i.outlet_id = p_outlet and i.product_id = p_product
       and coalesce(i.variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = coalesce(p_variant,   '00000000-0000-0000-0000-000000000000'::uuid)
       for update;
  end if;

  -- ── 2. Idempoten: id sudah tercatat -> kembalikan hasil lama, stok TIDAK disentuh.
  select * into v_old from public.stock_movements m where m.id = p_movement_id;
  if found then
    if v_old.outlet_id is distinct from p_outlet
       or v_old.product_id is distinct from p_product
       or v_old.variant_id is distinct from p_variant
       -- baris yang dinolkan karena notanya sudah void tetap kiriman ulang yang SAH (bukan id bentrok)
       or (p_set_to is null and v_old.quantity <> p_delta and not (v_txn_status = 'void' and v_old.quantity = 0))
       or (p_set_to is not null and v_old.after_stock <> p_set_to) then
      raise exception 'movement id % sudah dipakai untuk perubahan lain', p_movement_id using errcode = '23505';
    end if;
    return query select v_old.id, v_old.before_stock, v_old.after_stock, v_old.quantity, false;
    return;
  end if;

  -- ── 3. Hitung di bawah kunci = before/after yang SEBENARNYA.
  if p_expect_before is not null and v_before <> p_expect_before then
    raise exception 'STOK_BERUBAH: stok server % (layar %)', v_before, p_expect_before
      using errcode = 'P0001', detail = v_before::text;
  end if;
  if v_txn_status = 'void' then
    v_qty   := 0;
    v_after := v_before;
  elsif p_set_to is not null then
    v_after := p_set_to;
    v_qty   := p_set_to - v_before;
  else
    v_qty   := p_delta;
    v_after := v_before + p_delta;
  end if;
  if not coalesce(p_allow_negative, true) and v_after < 0 then
    raise exception 'STOK_KURANG: tersedia %, diminta %', v_before, -v_qty
      using errcode = 'P0001', detail = v_before::text;
  end if;

  -- ── 4. Riwayat + stok dalam transaksi yang sama: tak mungkin ada satu tanpa yang lain.
  --       Opname/SO yang angkanya sama tetap dicatat (quantity 0) supaya id-nya terkunci
  --       dan pemutaran ulang tak bisa menimpa penjualan yang terjadi sesudahnya.
  insert into public.stock_movements
    (id, tenant_id, outlet_id, product_id, variant_id, type, quantity, before_stock, after_stock, notes, reference_id, created_at)
  values
    (p_movement_id, '00000000-0000-0000-0000-000000000001', p_outlet, p_product, p_variant, p_type,
     v_qty, v_before, v_after,
     case when v_txn_status = 'void' then coalesce(p_notes, '') || ' — nota sudah void, stok tidak dipotong' else p_notes end,
     p_reference_id,
     case when p_created_at is null or p_created_at > now() then now() else p_created_at end);

  if v_qty <> 0 then
    update public.inventory set stock = v_after where id = v_inv_id;
  end if;

  return query select p_movement_id, v_before, v_after, v_qty, true;
end;
$$;

notify pgrst, 'reload schema';
