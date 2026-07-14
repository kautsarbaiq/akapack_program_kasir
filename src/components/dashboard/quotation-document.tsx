'use client'

import type { Quotation, QuotationStatus } from '@/types'
import { useOutletStore } from '@/stores/use-outlet-store'
import { useSettingsStore } from '@/stores/use-settings-store'
import { formatDate } from '@/lib/utils'

export const QUOTATION_STATUS: Record<QuotationStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#6b7280' },
  sent: { label: 'Terkirim', color: '#2563eb' },
  accepted: { label: 'Deal', color: '#16a34a' },
  rejected: { label: 'Ditolak', color: '#dc2626' },
}

const fmtNum = (n: number) => new Intl.NumberFormat('id-ID').format(n)

/** Kota untuk baris tanda tangan — ditebak dari nama outlet (Garut/Bandung). */
function cityOf(outletName: string): string {
  const n = outletName.toLowerCase()
  if (n.includes('garut')) return 'Garut'
  if (n.includes('bandung')) return 'Bandung'
  return outletName
}

/** Quotation / Surat Penawaran (cetak) — meniru format fisik toko. id="print-area" utk isolasi print. */
export function QuotationDocument({ doc }: { doc: Quotation }) {
  const outlets = useOutletStore((s) => s.outlets)
  const storeEmail = useSettingsStore((s) => s.storeEmail)

  const outlet = outlets.find((o) => o.id === doc.outlet_id)
  const headerName = outlet?.name ?? 'AKAPACK'
  const termLines = (doc.terms ?? '').split('\n').map((t) => t.trim()).filter(Boolean)

  const th: React.CSSProperties = { padding: '8px 10px', fontSize: 11, fontWeight: 700, border: '1px solid #111', textAlign: 'center' }
  const td: React.CSSProperties = { padding: '10px', fontSize: 12, border: '1px solid #111' }

  return (
    <div id="print-area" className="bg-white text-black mx-auto" style={{ width: '100%', maxWidth: 820, padding: 32, fontSize: 12 }}>
      {/* Kop: nama outlet (kiri) + kontak (kanan) */}
      <div className="flex items-start justify-between" style={{ borderBottom: '3px solid #111', paddingBottom: 14, marginBottom: 22 }}>
        <div>
          <p style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.5, textTransform: 'uppercase' }}>{headerName}</p>
          <p style={{ fontSize: 10, color: '#777', marginTop: 2 }}>akapack — plastik & mesin kemasan</p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#333', lineHeight: 1.6 }}>
          {outlet?.phone && <p>Telp : {outlet.phone}</p>}
          {storeEmail && <p>Email : {storeEmail}</p>}
          {outlet?.address && <p style={{ maxWidth: 300 }}>{outlet.address}</p>}
        </div>
      </div>

      {/* Kepada + meta kanan */}
      <div className="flex items-start justify-between" style={{ marginBottom: 20 }}>
        <div style={{ lineHeight: 1.6 }}>
          <p>Kepada Yth</p>
          <p style={{ fontWeight: 800 }}>{doc.customer_name}</p>
          <p>{doc.customer_address?.trim() || 'Di Tempat'}</p>
        </div>
        <div style={{ textAlign: 'left', fontSize: 12, lineHeight: 1.8 }}>
          <p>Tgl : {formatDate(doc.quote_date)}</p>
          <p style={{ fontFamily: 'monospace' }}>{doc.number}</p>
          <p>Lampiran : -</p>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontWeight: 800, fontStyle: 'italic', fontSize: 16, marginBottom: 14 }}>Invoice</p>

      {/* Tabel item */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 40 }}>No</th>
            <th style={th}>Keterangan</th>
            <th style={{ ...th, width: 110 }}>Unit Price(Rp)</th>
            <th style={{ ...th, width: 80 }}>QTY</th>
            <th style={{ ...th, width: 120 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((it, i) => (
            <tr key={it.id}>
              <td style={{ ...td, textAlign: 'center' }}>{i + 1}.</td>
              <td style={td}>{it.description}</td>
              <td style={{ ...td, textAlign: 'right' }}>{fmtNum(it.unit_price)}</td>
              <td style={{ ...td, textAlign: 'center' }}>{fmtNum(it.qty)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{fmtNum(it.total)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...td, textAlign: 'center' }} colSpan={2}><b><i>Total</i></b></td>
            <td style={td} />
            <td style={td} />
            <td style={{ ...td, textAlign: 'right', fontWeight: 800, fontStyle: 'italic' }}>{fmtNum(doc.total)}</td>
          </tr>
        </tbody>
      </table>

      {/* Catatan bullet */}
      <ul style={{ marginTop: 16, paddingLeft: 18, lineHeight: 1.8, listStyle: 'disc' }}>
        {termLines.map((t, i) => <li key={i}>{t}</li>)}
        {doc.bank_info && <li>Pembayaran Transfer : <b>{doc.bank_info}</b></li>}
      </ul>

      <p style={{ marginTop: 18, lineHeight: 1.7 }}>
        Demikian penawaran ini kami ajukan dengan harapan terciptanya kerjasama yang baik. Atas perhatiannya kami ucapkan terimakasih.
      </p>

      {/* Tanda tangan kanan */}
      <div style={{ marginTop: 26, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ textAlign: 'center', lineHeight: 1.8 }}>
          <p>{cityOf(headerName)}, {formatDate(doc.quote_date)}</p>
          <div style={{ height: 40 }} />
          <p style={{ fontWeight: 700 }}>{doc.created_by_name || '( ................................ )'}</p>
        </div>
      </div>
    </div>
  )
}
