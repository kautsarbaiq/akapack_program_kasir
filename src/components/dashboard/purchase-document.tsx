'use client'

import type { PurchaseOrder } from '@/types'
import { useProductStore } from '@/stores/use-product-store'
import { useSettingsStore } from '@/stores/use-settings-store'
import { formatRupiah, formatDate } from '@/lib/utils'

const STATUS_LABEL: Record<PurchaseOrder['status'], { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#6b7280' },
  ordered: { label: 'Dipesan', color: '#2563eb' },
  received: { label: 'Posted', color: '#059669' },
  cancelled: { label: 'Batal', color: '#dc2626' },
}
const PAYMENT_LABEL: Record<PurchaseOrder['payment'], string> = { cash: 'Tunai', transfer: 'Transfer', credit: 'Tempo (Hutang)' }

/**
 * Dokumen Stok Masuk (cetak) — gaya invoice. Dipakai untuk pratinjau & window.print().
 * Bungkus dengan id="print-area" agar CSS print mengisolasi hanya dokumen ini.
 */
export function PurchaseDocument({ po }: { po: PurchaseOrder }) {
  const products = useProductStore((s) => s.products)
  const storeName = useSettingsStore((s) => s.storeName)
  const storeAddress = useSettingsStore((s) => s.storeAddress)
  const storePhone = useSettingsStore((s) => s.storePhone)

  const st = STATUS_LABEL[po.status]
  const totalQty = po.items.reduce((s, i) => s + i.qty, 0)
  const avgCost = (productId: string, fallback: number) => {
    const p = products.find((x) => x.id === productId)
    return p ? p.cost_price : fallback
  }

  return (
    <div id="print-area" className="bg-white text-black mx-auto" style={{ width: '100%', maxWidth: 760, padding: 28, fontSize: 13 }}>
      {/* Kop */}
      <div className="flex items-start justify-between" style={{ borderBottom: '2px solid #111', paddingBottom: 14, marginBottom: 18 }}>
        <div>
          <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>{storeName || 'AKAPACK'}</p>
          {storeAddress && <p style={{ color: '#555', fontSize: 11, marginTop: 2, maxWidth: 320 }}>{storeAddress}</p>}
          {storePhone && <p style={{ color: '#555', fontSize: 11 }}>{storePhone}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>STOK MASUK</p>
          <p style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, marginTop: 2 }}>{po.number}</p>
          <span style={{ display: 'inline-block', marginTop: 6, padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#fff', background: st.color }}>{st.label}</span>
        </div>
      </div>

      {/* Info */}
      <div className="grid grid-cols-2 gap-4" style={{ marginBottom: 18 }}>
        <div>
          <p style={{ fontSize: 10, textTransform: 'uppercase', color: '#888', letterSpacing: 0.5 }}>Tanggal</p>
          <p style={{ fontWeight: 600 }}>{formatDate(po.date)}</p>
          {po.received_at && <p style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Diterima: {formatDate(po.received_at)}</p>}
        </div>
        <div>
          <p style={{ fontSize: 10, textTransform: 'uppercase', color: '#888', letterSpacing: 0.5 }}>Supplier</p>
          <p style={{ fontWeight: 600 }}>{po.supplier?.name ?? '—'}</p>
          <p style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Pembayaran: {PAYMENT_LABEL[po.payment]}{po.payment === 'credit' && po.status === 'received' ? (po.paid ? ' · Lunas' : ' · Belum lunas') : ''}</p>
        </div>
      </div>

      {po.notes && (
        <div style={{ marginBottom: 16, padding: 10, background: '#f7f7f7', borderRadius: 8 }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', color: '#888', letterSpacing: 0.5, marginBottom: 2 }}>Catatan</p>
          <p style={{ fontSize: 12 }}>{po.notes}</p>
        </div>
      )}

      {/* Item */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11 }}>No</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11 }}>Nama Produk</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 11 }}>Harga Beli</th>
            <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 11 }}>Qty</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 11 }}>Rata-rata H. Beli</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 11 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {po.items.map((it, i) => (
            <tr key={it.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '8px 10px', color: '#888' }}>{i + 1}</td>
              <td style={{ padding: '8px 10px', fontWeight: 600 }}>{it.product_name}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatRupiah(it.cost)}</td>
              <td style={{ padding: '8px 10px', textAlign: 'center' }}>{it.qty}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', color: '#555' }}>{formatRupiah(avgCost(it.product_id, it.cost))}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{formatRupiah(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid #111' }}>
            <td colSpan={3} style={{ padding: '10px', fontWeight: 700 }}>Total</td>
            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700 }}>{totalQty}</td>
            <td />
            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800, fontSize: 14 }}>{formatRupiah(po.total)}</td>
          </tr>
        </tfoot>
      </table>

      <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888' }}>
        <span>Dicetak dari {storeName || 'AKAPACK'} POS</span>
        <span>Dokumen tidak memerlukan tanda tangan basah</span>
      </div>
    </div>
  )
}
