'use client'

import type { SalesOrder, SalesOrderStatus } from '@/types'
import { useOutletStore } from '@/stores/use-outlet-store'
import { useSettingsStore } from '@/stores/use-settings-store'
import { formatRupiah, formatDate } from '@/lib/utils'

export const SALES_ORDER_STATUS: Record<SalesOrderStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#6b7280' },
  confirmed: { label: 'Dikonfirmasi', color: '#2563eb' },
  done: { label: 'Selesai', color: '#16a34a' },
  cancelled: { label: 'Batal', color: '#9ca3af' },
}

/** Surat Pesanan (cetak) — gaya invoice. Bungkus id="print-area" untuk isolasi print. */
export function SalesOrderDocument({ doc }: { doc: SalesOrder }) {
  const outlets = useOutletStore((s) => s.outlets)
  const storeName = useSettingsStore((s) => s.storeName)
  const storeAddress = useSettingsStore((s) => s.storeAddress)
  const storePhone = useSettingsStore((s) => s.storePhone)

  const st = SALES_ORDER_STATUS[doc.status]
  const outletName = outlets.find((o) => o.id === doc.outlet_id)?.name ?? '—'

  const label = (t: string) => <p style={{ fontSize: 10, textTransform: 'uppercase', color: '#888', letterSpacing: 0.5 }}>{t}</p>

  return (
    <div id="print-area" className="bg-white text-black mx-auto" style={{ width: '100%', maxWidth: 760, padding: 28, fontSize: 13 }}>
      <div className="flex items-start justify-between" style={{ borderBottom: '2px solid #111', paddingBottom: 14, marginBottom: 18 }}>
        <div>
          <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>{storeName || 'AKAPACK'}</p>
          {storeAddress && <p style={{ color: '#555', fontSize: 11, marginTop: 2, maxWidth: 320 }}>{storeAddress}</p>}
          {storePhone && <p style={{ color: '#555', fontSize: 11 }}>{storePhone}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>SURAT PESANAN</p>
          <p style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, marginTop: 2 }}>{doc.number}</p>
          <span style={{ display: 'inline-block', marginTop: 6, padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#fff', background: st.color }}>{st.label}</span>
        </div>
      </div>

      {/* Pelanggan + meta */}
      <div className="grid grid-cols-2 gap-6" style={{ marginBottom: 18 }}>
        <div>
          {label('Pelanggan')}
          <p style={{ fontWeight: 700, fontSize: 14 }}>{doc.customer_name}</p>
          {doc.customer_address && <p style={{ color: '#444', fontSize: 12, marginTop: 2, maxWidth: 320 }}>{doc.customer_address}</p>}
          {doc.customer_phone && <p style={{ color: '#444', fontSize: 12 }}>{doc.customer_phone}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ marginBottom: 8 }}>{label('Tanggal')}<p style={{ fontWeight: 600 }}>{formatDate(doc.order_date)}</p></div>
          <div style={{ marginBottom: 8 }}>{label('Sales')}<p style={{ fontWeight: 600 }}>{doc.sales_name || '—'}</p></div>
          <div>{label('Outlet')}<p style={{ fontWeight: 600 }}>{outletName}</p></div>
        </div>
      </div>

      {(doc.bank_name || doc.bank_ref) && (
        <div style={{ marginBottom: 16, padding: 10, background: '#f7f7f7', borderRadius: 8, display: 'flex', gap: 28 }}>
          <div>{label('Nama Bank')}<p style={{ fontWeight: 600 }}>{doc.bank_name || '—'}</p></div>
          <div>{label('No. Ref / Rekening')}<p style={{ fontWeight: 600, fontFamily: 'monospace' }}>{doc.bank_ref || '—'}</p></div>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11 }}>No</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11 }}>Nama Barang</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 11 }}>Harga</th>
            <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 11 }}>Qty</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 11 }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((it, i) => (
            <tr key={it.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '8px 10px', color: '#888' }}>{i + 1}</td>
              <td style={{ padding: '8px 10px', fontWeight: 600 }}>{it.product_name}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatRupiah(it.price)}</td>
              <td style={{ padding: '8px 10px', textAlign: 'center' }}>{it.qty}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{formatRupiah(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Ringkasan: subtotal + ongkir = total */}
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: 280 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span style={{ color: '#555' }}>Subtotal</span><span style={{ fontWeight: 600 }}>{formatRupiah(doc.subtotal)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span style={{ color: '#555' }}>Ongkir</span><span style={{ fontWeight: 600 }}>{formatRupiah(doc.shipping_cost)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #111', marginTop: 4 }}><span style={{ fontWeight: 800 }}>TOTAL</span><span style={{ fontWeight: 800, fontSize: 15 }}>{formatRupiah(doc.total)}</span></div>
        </div>
      </div>

      {doc.notes && (
        <div style={{ marginTop: 14, padding: 10, background: '#f7f7f7', borderRadius: 8 }}>
          {label('Catatan')}<p style={{ fontSize: 12 }}>{doc.notes}</p>
        </div>
      )}

      <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888' }}>
        <span>Dicetak dari {storeName || 'AKAPACK'} POS</span>
        <span>Surat pesanan — bukan bukti pembayaran</span>
      </div>
    </div>
  )
}
