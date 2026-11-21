-- Perbaikan penjualan tanpa riwayat stok sejak 6 Nov 2026 (termasuk TRX-20261117-A0050).
-- Aman dijalankan ulang: id baris tetap (md5), sudah tercatat = dilewati.
drop table if exists public._fix_20261120;
create table public._fix_20261120 as
with li as (
  select t.id tid, t.transaction_number trx, t.outlet_id, t.created_at, ti.product_id, ti.product_name, sum(ti.quantity)::int qty
  from transactions t join transaction_items ti on ti.transaction_id=t.id
  where t.status='completed' and t.created_at >= '2026-11-06' and ti.product_id is not null
    and not exists (select 1 from stock_movements m where m.reference_id=t.id and m.product_id=ti.product_id)
  group by 1,2,3,4,5,6),
x as (
 select li.*, p.after_stock prev_after, p.applied_seq prev_seq, n.before_stock next_before,
  (select i.stock from inventory i where i.product_id=li.product_id and i.outlet_id=li.outlet_id) now_stock,
  exists(select 1 from stock_movements m where m.product_id=li.product_id and m.outlet_id=li.outlet_id and m.created_at>li.created_at and m.type in ('opname','adjustment')) later_opname
 from li
 left join lateral (select after_stock, applied_seq from stock_movements m where m.product_id=li.product_id and m.outlet_id=li.outlet_id and m.created_at<li.created_at order by m.created_at desc limit 1) p on true
 left join lateral (select before_stock from stock_movements m where m.product_id=li.product_id and m.outlet_id=li.outlet_id and m.created_at>li.created_at order by m.created_at limit 1) n on true)
select x.*, case
  when prev_after is null then 'unclear'
  when coalesce(next_before, now_stock) = prev_after - qty then 'cut'
  when coalesce(next_before, now_stock) = prev_after and later_opname then 'absorbed'
  when coalesce(next_before, now_stock) = prev_after then 'notcut'
  else 'unclear' end cls,
  md5('backfill:'||tid||':'||product_id)::uuid mid
from x;

-- 1) Stok sudah terpotong, riwayat hilang → tambah riwayat saja (disisipkan setelah baris sebelumnya).
insert into stock_movements (id, outlet_id, product_id, type, quantity, before_stock, after_stock, notes, reference_id, created_at, applied_seq)
select mid, outlet_id, product_id, 'out', -qty, prev_after, prev_after - qty, 'Penjualan POS (riwayat dicatat ulang)', tid, created_at, prev_seq
from public._fix_20261120 where cls = 'cut' on conflict (id) do nothing;

-- 2) Sudah dibetulkan lewat opname → riwayat saja, stok tidak diubah.
insert into stock_movements (id, outlet_id, product_id, type, quantity, before_stock, after_stock, notes, reference_id, created_at, applied_seq)
select mid, outlet_id, product_id, 'out', -qty, prev_after, prev_after, 'Penjualan POS (offline — stok sudah dibetulkan lewat opname)', tid, created_at, prev_seq
from public._fix_20261120 where cls = 'absorbed' on conflict (id) do nothing;

-- 3) Stok tidak pernah terpotong → potong sekarang + riwayat (fungsi atomik, idempoten per id).
select apply_stock_movement(mid, outlet_id, product_id, null, -qty, 'out',
  'Penjualan POS (offline — stok dipotong susulan)', tid, created_at, null, true, null)
from (select * from public._fix_20261120 where cls = 'notcut' order by created_at) s;

drop table public._fix_20261120;

-- Cek hasil: harus 0.
select count(*) as sisa_penjualan_tanpa_riwayat
from transactions t join transaction_items ti on ti.transaction_id = t.id
where t.status = 'completed' and t.created_at >= '2026-11-06' and ti.product_id is not null
  and not exists (select 1 from stock_movements m where m.reference_id = t.id and m.product_id = ti.product_id);
