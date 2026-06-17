'use client'

import type { StockOut, StockOutReason, StockOutStatus } from '@/types'
import { useOutletStore } from '@/stores/use-outlet-store'
import { useSettingsStore } from '@/stores/use-settings-store'
import { formatRupiah, formatDate } from '@/lib/utils'

const STATUS_LABEL: Record<StockOutStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#6b7280' },
  posted: { label: 'Posted', color: '#dc2626' },
  cancelled: { label: 'Batal', color: '#9ca3af' },
}
export const REASON_LABEL: Record<StockOutReason, string> = {
  rusak: 'Barang Rusak',
  hilang: 'Hilang',
  pemakaian: 'Pemakaian Internal',
  retur: 'Retur ke Supplier',
  penyesuaian: 'Penyesuaian Stok',
  lainnya: 'Lainnya',
}

/** Dokumen Stok Keluar (cetak) — gaya invoice. Bungkus id="print-area" untuk isolasi print. */
export function StockOutDocument({ doc }: { doc: StockOut }) {
  const outlets = useOutletStore((s) => s.outlets)
  const storeName = useSettingsStore((s) => s.storeName)
  const storeAddress = useSettingsStore((s) => s.storeAddress)
  const storePhone = useSettingsStore((s) => s.storePhone)

  const st = STATUS_LABEL[doc.status]
  const outletName = outlets.find((o) => o.id === doc.outlet_id)?.name ?? '—'

  return (
    <div id="print-area" className="bg-white text-black mx-auto" style={{ width: '100%', maxWidth: 760, padding: 28, fontSize: 13 }}>
      <div className="flex items-start justify-between" style={{ borderBottom: '2px solid #111', paddingBottom: 14, marginBottom: 18 }}>
        <div>
          <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>{storeName || 'AKAPACK'}</p>
          {storeAddress && <p style={{ color: '#555', fontSize: 11, marginTop: 2, maxWidth: 320 }}>{storeAddress}</p>}
          {storePhone && <p style={{ color: '#555', fontSize: 11 }}>{storePhone}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>STOK KELUAR</p>
          <p style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, marginTop: 2 }}>{doc.number}</p>
          <span style={{ display: 'inline-block', marginTop: 6, padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#fff', background: st.color }}>{st.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 18 }}>
        <div>
          <p style={{ fontSize: 10, textTransform: 'uppercase', color: '#888', letterSpacing: 0.5 }}>Tanggal</p>
          <p style={{ fontWeight: 600 }}>{formatDate(doc.date)}</p>
        </div>
        <div>
          <p style={{ fontSize: 10, textTransform: 'uppercase', color: '#888', letterSpacing: 0.5 }}>Outlet</p>
          <p style={{ fontWeight: 600 }}>{outletName}</p>
        </div>
        <div>
          <p style={{ fontSize: 10, textTransform: 'uppercase', color: '#888', letterSpacing: 0.5 }}>Alasan</p>
          <p style={{ fontWeight: 600 }}>{REASON_LABEL[doc.reason]}</p>
        </div>
      </div>

      {doc.notes && (
        <div style={{ marginBottom: 16, padding: 10, background: '#f7f7f7', borderRadius: 8 }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', color: '#888', letterSpacing: 0.5, marginBottom: 2 }}>Catatan</p>
          <p style={{ fontSize: 12 }}>{doc.notes}</p>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11 }}>No</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11 }}>Nama Produk</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 11 }}>Nilai Modal</th>
            <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 11 }}>Qty</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 11 }}>Total Nilai</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((it, i) => (
            <tr key={it.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '8px 10px', color: '#888' }}>{i + 1}</td>
              <td style={{ padding: '8px 10px', fontWeight: 600 }}>{it.product_name}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatRupiah(it.cost)}</td>
              <td style={{ padding: '8px 10px', textAlign: 'center' }}>{it.qty}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{formatRupiah(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid #111' }}>
            <td colSpan={3} style={{ padding: '10px', fontWeight: 700 }}>Total</td>
            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700 }}>{doc.total_qty}</td>
            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800, fontSize: 14 }}>{formatRupiah(doc.total)}</td>
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
