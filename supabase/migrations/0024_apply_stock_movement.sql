-- 0024: STOK + RIWAYAT DALAM SATU TRANSAKSI DB, IDEMPOTEN.
--
-- Masalah (audit 26 Okt 2026): apply_stock_delta (0023) hanya mengubah stok. Riwayat ditulis klien
-- terpisah (insert sekali, tanpa retry), dengan before/after dari memori perangkat yang bisa basi.
--   - SSY Rectangle 650ML (Bandung): penjualan TRX-20261023-A0074 memotong stok, tapi riwayatnya
--     hilang, jadi History menampilkan 100 -> 99 -> 89 tanpa penjualannya (karyawan mengira harus 90).
--   - Wooden Spork (Garut): penjualan 8 Okt dicatat 68 -> 67 dari memori lama; server sebenarnya 98 -> 97.
--   - Retry RPC setelah respons hilang bisa memotong stok 2x tanpa jejak.
-- Perbaikan: satu fungsi mengunci baris inventory, menghitung before/after YANG SEBENARNYA,
-- menulis riwayat dan stok sekaligus. id pergerakan dari klien = kunci idempoten: kalau id itu
-- sudah ada, kembalikan hasil lama dan stok TIDAK diubah lagi.
--
-- apply_stock_delta (0023) SENGAJA tidak diubah: klien lama yang belum reload masih memanggilnya
-- dan menulis riwayat sendiri. Kalau fungsi lama ikut menulis riwayat, riwayatnya jadi dobel.

-- ── 0. Kolom tambahan (aditif; insert REST dari klien lama tetap jalan) ───────────────────────
alter table public.stock_movements
  add column if not exists variant_id uuid references public.product_variants(id) on delete set null;

-- Urutan TERAP yang sebenarnya. created_at = waktu kejadian menurut klien (bisa mundur: antrean
-- offline, tanggal pilihan di Inventori). Rantai before/after hanya nyambung bila diurutkan dengan ini.
create sequence if not exists public.stock_movements_applied_seq;
alter table public.stock_movements add column if not exists applied_seq bigint;   -- baris lama tetap NULL (tanpa rewrite tabel)
alter table public.stock_movements alter column applied_seq set default nextval('public.stock_movements_applied_seq');
alter sequence public.stock_movements_applied_seq owned by public.stock_movements.applied_seq;
grant usage, select on sequence public.stock_movements_applied_seq to anon, authenticated; -- insert REST klien lama memanggil default ini

create index if not exists idx_stock_movements_chain
  on public.stock_movements (outlet_id, product_id, applied_seq);
create index if not exists idx_stock_movements_reference
  on public.stock_movements (reference_id) where reference_id is not null;

-- ── 1. Satu perubahan stok ─────────────────────────────────────────────────────────────────────
-- Error kelas 22xxx / 23xxx / P0001 = PERMANEN (klien: jangan diulang, pindah ke dead-letter).
-- Error jaringan / 5xx / 40001 / 40P01 / 57014 (timeout) = SEMENTARA (ulangi dengan id yang SAMA).
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
  if p_variant is not null and not exists (
       select 1 from public.product_variants pv where pv.id = p_variant and pv.product_id = p_product) then
    raise exception 'varian % bukan milik produk %', p_variant, p_product using errcode = '23503';
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
       or (p_set_to is null and v_old.quantity <> p_delta)
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
  if p_set_to is not null then
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
     v_qty, v_before, v_after, p_notes, p_reference_id,
     case when p_created_at is null or p_created_at > now() then now() else p_created_at end);

  if v_qty <> 0 then
    update public.inventory set stock = v_after where id = v_inv_id;
  end if;

  return query select p_movement_id, v_before, v_after, v_qty, true;
end;
$$;

-- ── 2. Banyak perubahan, SATU transaksi (nota POS, transfer 2 sisi, posting dokumen, potongan impor)
-- Semua baris berhasil atau tidak satu pun. Dikunci dalam urutan tetap (outlet, produk, varian)
-- supaya dua batch yang menyentuh barang sama dalam urutan berbeda tidak deadlock; baris untuk
-- barang yang SAMA tetap diterapkan sesuai urutan kiriman. Hasil dipetakan lewat movement_id,
-- BUKAN posisi.
create or replace function public.apply_stock_movements(p_lines jsonb)
returns table (movement_id uuid, before_stock integer, after_stock integer, quantity integer, applied boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'p_lines harus array JSON' using errcode = '22023';
  end if;
  if jsonb_array_length(p_lines) > 500 then
    raise exception 'maksimal 500 baris per panggilan (dapat %)', jsonb_array_length(p_lines) using errcode = '22023';
  end if;
  for r in
    select l.*, x.ord
      from jsonb_array_elements(p_lines) with ordinality as x(elem, ord)
      cross join lateral jsonb_to_record(x.elem) as l(
        id uuid, outlet_id uuid, product_id uuid, variant_id uuid, delta integer, set_to integer,
        type text, notes text, reference_id uuid, created_at timestamptz,
        allow_negative boolean, expect_before integer)
     order by l.outlet_id, l.product_id,
              coalesce(l.variant_id, '00000000-0000-0000-0000-000000000000'::uuid), x.ord
  loop
    return query
      select * from public.apply_stock_movement(
        r.id, r.outlet_id, r.product_id, r.variant_id, r.delta, r.type, r.notes, r.reference_id,
        r.created_at, r.set_to, coalesce(r.allow_negative, true), r.expect_before);
  end loop;
end;
$$;

-- ── 3. Void / batal pesanan DI SERVER ────────────────────────────────────────────────────────
-- Membalik pergerakan 'out' yang BENAR-BENAR tercatat untuk nota ini (qty satuan dasar, varian ikut),
-- bukan menebak dari nama item. Status dikunci, jadi dua perangkat tak bisa me-void dua kali.
-- id pembalik = md5('void:'||id_asal), jadi panggilan ulang tak mengembalikan stok dua kali.
create or replace function public.void_sale_with_stock(
  p_txn_id uuid,
  p_actor  text    default null,
  p_force  boolean default false   -- true = void walau nota tak punya jejak stok keluar (stok tidak dikembalikan)
)
returns table (movement_id uuid, before_stock integer, after_stock integer, quantity integer, applied boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_status text;
  v_number text;
  m record;
begin
  select t.status, t.transaction_number into v_status, v_number
    from public.transactions t where t.id = p_txn_id
     for update;
  if not found then
    raise exception 'transaksi % belum ada di server (mungkin masih di antrean perangkat kasir)', p_txn_id
      using errcode = 'P0002';
  end if;

  if v_status = 'void' then
    -- Sudah di-void (panggilan ulang / perangkat lain): kembalikan pembalik yang ada, stok tidak diubah.
    return query
      select sm.id, sm.before_stock, sm.after_stock, sm.quantity, false
        from public.stock_movements sm
       where sm.reference_id = p_txn_id and sm.type = 'in';
    return;
  end if;
  if v_status not in ('completed', 'pending') then
    raise exception 'status % tidak bisa di-void', v_status using errcode = '22023';
  end if;

  if not p_force and not exists (
       select 1 from public.stock_movements sm
        where sm.reference_id = p_txn_id and sm.type = 'out' and sm.quantity < 0) then
    raise exception 'STOK_BELUM_TERCATAT: nota % tidak punya jejak stok keluar', v_number
      using errcode = 'P0001';
  end if;

  for m in
    select sm.id, sm.outlet_id, sm.product_id, sm.variant_id, sm.quantity
      from public.stock_movements sm
     where sm.reference_id = p_txn_id and sm.type = 'out' and sm.quantity < 0
     order by sm.outlet_id, sm.product_id,
              coalesce(sm.variant_id, '00000000-0000-0000-0000-000000000000'::uuid), sm.created_at, sm.id
  loop
    return query
      select * from public.apply_stock_movement(
        md5('void:' || m.id::text)::uuid, m.outlet_id, m.product_id, m.variant_id, -m.quantity, 'in',
        'Void ' || v_number || coalesce(' oleh ' || p_actor, ''), p_txn_id,
        null, null, true, null);
  end loop;

  update public.transactions set status = 'void' where id = p_txn_id;
end;
$$;

revoke all on function public.apply_stock_movement(uuid, uuid, uuid, uuid, integer, text, text, uuid, timestamptz, integer, boolean, integer) from public;
revoke all on function public.apply_stock_movements(jsonb) from public;
revoke all on function public.void_sale_with_stock(uuid, text, boolean) from public;
grant execute on function public.apply_stock_movement(uuid, uuid, uuid, uuid, integer, text, text, uuid, timestamptz, integer, boolean, integer) to anon, authenticated;
grant execute on function public.apply_stock_movements(jsonb) to anon, authenticated;
grant execute on function public.void_sale_with_stock(uuid, text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
