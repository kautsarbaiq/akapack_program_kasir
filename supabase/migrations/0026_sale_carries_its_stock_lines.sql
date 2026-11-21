-- 0026 — Nota membawa potongan stoknya sendiri.
--
-- Masalah: nota dan potongan stoknya dikirim lewat DUA antrean terpisah di peramban kasir. Kalau
-- antrean stok hilang (data peramban dibersihkan, komputer rusak, pindah perangkat) sementara notanya
-- sempat terkirim, nota tersimpan tanpa stok terpotong — pola TRX-20261117-A0050.
--
-- Solusi: kasir menyertakan baris potongan stok (dengan id pergerakan yang SAMA seperti di antrean
-- stok) di kolom transactions.stock_lines. Saat header nota disisipkan, trigger ini menerapkannya lewat
-- apply_stock_movement dalam transaksi DB yang sama, lalu MENGOSONGKAN kolomnya (jejaknya sudah ada di
-- stock_movements / stock_apply_errors — memuat nota tak perlu ikut mengunduhnya). Sisipan gagal
-- (mis. id nota sudah ada) membatalkan potongannya juga. Siapa pun yang sampai duluan — nota atau antrean
-- stok — stok terpotong tepat SEKALI (id = kunci idempoten).
--
-- Nota TIDAK PERNAH gagal tersimpan karena stok: tiap baris dijalankan dalam blok tersendiri; yang
-- gagal (produk terhapus, dsb.) dicatat di stock_apply_errors dan antrean stok kasir tetap mencobanya.
-- Hanya potongan PENJUALAN yang diterima: type 'out', delta ≤ 0, cabang = cabang nota, bukan set_to.

alter table public.transactions add column if not exists stock_lines jsonb;

create table if not exists public.stock_apply_errors (
  id             bigserial primary key,
  transaction_id uuid,
  line           jsonb,
  code           text,
  message        text,
  created_at     timestamptz not null default now()
);

create or replace function public.trg_transactions_apply_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  if jsonb_typeof(new.stock_lines) is distinct from 'array' then
    new.stock_lines := null;
    return new;
  end if;
  -- Urutan kunci sama dengan apply_stock_movements (anti-deadlock antar kasir).
  for r in
    select l.*, x.elem
      from jsonb_array_elements(new.stock_lines) with ordinality as x(elem, ord)
      cross join lateral jsonb_to_record(x.elem) as l(
        id uuid, outlet_id uuid, product_id uuid, variant_id uuid, delta integer, set_to integer,
        type text, notes text)
     order by l.outlet_id, l.product_id,
              coalesce(l.variant_id, '00000000-0000-0000-0000-000000000000'::uuid), x.ord
  loop
    begin
      if r.type is distinct from 'out' or r.set_to is not null or r.delta is null or r.delta > 0
         or r.outlet_id is distinct from new.outlet_id then
        raise exception 'baris stok nota tidak valid' using errcode = '22023';
      end if;
      perform public.apply_stock_movement(
        r.id, r.outlet_id, r.product_id, r.variant_id, r.delta, 'out', r.notes, new.id,
        new.created_at, null, true, null);
    exception when others then
      insert into public.stock_apply_errors (transaction_id, line, code, message)
      values (new.id, r.elem, sqlstate, sqlerrm);
    end;
  end loop;
  new.stock_lines := null;
  return new;
end;
$$;

drop trigger if exists transactions_apply_stock on public.transactions;
create trigger transactions_apply_stock
  before insert on public.transactions
  for each row
  when (new.stock_lines is not null)
  execute function public.trg_transactions_apply_stock();

notify pgrst, 'reload schema';
