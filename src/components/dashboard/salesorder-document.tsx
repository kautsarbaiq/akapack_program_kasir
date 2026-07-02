'use client'

import type { SalesOrder, SalesOrderStatus } from '@/types'
import { useOutletStore } from '@/stores/use-outlet-store'
import { useSettingsStore } from '@/stores/use-settings-store'
import { useProductStore } from '@/stores/use-product-store'
import { formatRupiah, formatDate, terbilang } from '@/lib/utils'

export const SALES_ORDER_STATUS: Record<SalesOrderStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#6b7280' },
  confirmed: { label: 'Dikonfirmasi', color: '#2563eb' },
  done: { label: 'Selesai', color: '#16a34a' },
  cancelled: { label: 'Batal', color: '#9ca3af' },
}

/** Surat Pesanan (cetak) — gaya Faktur Penjualan. Bungkus id="print-area" untuk isolasi print. */
export function SalesOrderDocument({ doc }: { doc: SalesOrder }) {
  const outlets = useOutletStore((s) => s.outlets)
  const products = useProductStore((s) => s.products)
  const storeName = useSettingsStore((s) => s.storeName)
  const storeAddress = useSettingsStore((s) => s.storeAddress)
  const storePhone = useSettingsStore((s) => s.storePhone)

  const st = SALES_ORDER_STATUS[doc.status]
  const outletName = outlets.find((o) => o.id === doc.outlet_id)?.name ?? '—'
  const totalQty = doc.items.reduce((s, it) => s + (it.qty || 0), 0)
  const prodOf = (pid: string) => products.find((p) => p.id === pid)
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  const th: React.CSSProperties = { padding: '7px 8px', fontSize: 11, borderBottom: '1.5px solid #111' }
  const td: React.CSSProperties = { padding: '6px 8px', fontSize: 12, borderBottom: '1px solid #e5e7eb' }
  const metaRow = (k: string, v: string) => (
    <div style={{ display: 'flex', gap: 6 }}>
      <span style={{ width: 78, color: '#666', flexShrink: 0 }}>{k}</span>
      <span style={{ color: '#666' }}>:</span>
      <span style={{ fontWeight: 600, flex: 1 }}>{v}</span>
    </div>
  )

  return (
    <div id="print-area" className="bg-white text-black mx-auto" style={{ width: '100%', maxWidth: 820, padding: 28, fontSize: 12 }}>
      {/* Header: penjual (kiri) + judul & no (kanan) */}
      <div className="flex items-start justify-between" style={{ borderBottom: '2px solid #111', paddingBottom: 12, marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>{storeName || 'AKAPACK'}</p>
          {storeAddress && <p style={{ color: '#555', fontSize: 11, marginTop: 2, maxWidth: 340 }}>{storeAddress}</p>}
          {storePhone && <p style={{ color: '#555', fontSize: 11 }}>{storePhone}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>SURAT PESANAN</p>
          <p style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, marginTop: 2 }}>{doc.number}</p>
          <span style={{ display: 'inline-block', marginTop: 6, padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#fff', background: st.color }}>{st.label}</span>
        </div>
      </div>

      {/* Info pelanggan + dokumen */}
      <div className="grid grid-cols-2 gap-8" style={{ marginBottom: 14, fontSize: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {metaRow('Pelanggan', doc.customer_name)}
          {metaRow('Alamat', doc.customer_address || '—')}
          {metaRow('No. HP', doc.customer_phone || '—')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {metaRow('Tanggal', formatDate(doc.order_date))}
          {metaRow('Sales', doc.sales_name || '—')}
          {metaRow('Outlet', outletName)}
        </div>
      </div>

      {/* Rincian barang */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ ...th, textAlign: 'left' }}>No</th>
            <th style={{ ...th, textAlign: 'left' }}>Kode Item</th>
            <th style={{ ...th, textAlign: 'left' }}>Nama Item</th>
            <th style={{ ...th, textAlign: 'right' }}>Jumlah</th>
            <th style={{ ...th, textAlign: 'left' }}>Sat</th>
            <th style={{ ...th, textAlign: 'right' }}>Harga</th>
            <th style={{ ...th, textAlign: 'right' }}>Pot</th>
            <th style={{ ...th, textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((it, i) => {
            const p = prodOf(it.product_id)
            return (
              <tr key={it.id}>
                <td style={{ ...td, color: '#888' }}>{i + 1}</td>
                <td style={{ ...td, fontFamily: 'monospace' }}>{p?.sku ?? '—'}</td>
                <td style={{ ...td, fontWeight: 600 }}>{it.product_name}</td>
                <td style={{ ...td, textAlign: 'right' }}>{it.qty}</td>
                <td style={{ ...td }}>{p?.unit ?? 'pcs'}</td>
                <td style={{ ...td, textAlign: 'right' }}>{formatRupiah(it.price)}</td>
                <td style={{ ...td, textAlign: 'right' }}>0</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{formatRupiah(it.subtotal)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Ringkasan */}
      <div className="flex items-start justify-between" style={{ marginTop: 12, gap: 24 }}>
        <div style={{ fontSize: 11, color: '#444', maxWidth: 340 }}>
          <p><b>Jumlah Item:</b> {totalQty}</p>
          <p style={{ marginTop: 6 }}><b>Terbilang:</b> {cap(terbilang(doc.total))} rupiah</p>
          {(doc.bank_name || doc.bank_ref) && (
            <p style={{ marginTop: 6 }}><b>Transfer pembayaran ke:</b> {doc.bank_name || ''} {doc.bank_ref ? `· ${doc.bank_ref}` : ''}</p>
          )}
          {doc.notes && <p style={{ marginTop: 6 }}><b>Keterangan:</b> {doc.notes}</p>}
        </div>
        <div style={{ width: 260 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ color: '#555' }}>Sub Total</span><span style={{ fontWeight: 600 }}>{formatRupiah(doc.subtotal)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ color: '#555' }}>Ongkir</span><span style={{ fontWeight: 600 }}>{formatRupiah(doc.shipping_cost)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #111', marginTop: 4 }}><span style={{ fontWeight: 800 }}>TOTAL AKHIR</span><span style={{ fontWeight: 800, fontSize: 15 }}>{formatRupiah(doc.total)}</span></div>
        </div>
      </div>

      {/* Tanda tangan */}
      <div className="grid grid-cols-2 gap-8" style={{ marginTop: 34, fontSize: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#555' }}>Penerima,</p>
          <div style={{ height: 54 }} />
          <p style={{ borderTop: '1px solid #999', paddingTop: 4 }}>( ................................ )</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#555' }}>Hormat Kami,</p>
          <div style={{ height: 54 }} />
          <p style={{ borderTop: '1px solid #999', paddingTop: 4 }}>{doc.sales_name ? `( ${doc.sales_name} )` : '( ................................ )'}</p>
        </div>
      </div>

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#999' }}>
        <span>Dicetak dari {storeName || 'AKAPACK'} POS</span>
        <span>Surat pesanan — bukan bukti pembayaran</span>
      </div>
    </div>
  )
}
