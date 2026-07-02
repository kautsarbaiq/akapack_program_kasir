import { formatRupiah, formatDateTime } from './utils'
import { PAYMENT_LABELS } from './constants'
import type { Transaction } from '@/types'

interface ReceiptHeader { name: string; address?: string; phone?: string; footer?: string }

const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))

/**
 * Cetak struk 76mm untuk sebuah transaksi (dipakai POS & cetak-ulang dari Riwayat Transaksi).
 * Membuat iframe terisolasi berisi HANYA struk → posisi & ukuran kertas pasti benar.
 */
export function printReceipt(t: Transaction, header: ReceiptHeader) {
  if (typeof window === 'undefined') return
  const line = '<div style="border-top:1px dashed #000;margin:6px 0"></div>'
  const rows = t.items.map((it) =>
    `<div style="margin-bottom:3px"><div>${esc(it.product_name)}</div>` +
    `<div style="display:flex;justify-content:space-between"><span>${it.quantity} x ${formatRupiah(it.product_price)}</span><span>${formatRupiah(it.subtotal)}</span></div></div>`
  ).join('')
  const inner =
    `<div style="text-align:center"><div style="font-weight:700;font-size:22px">${esc(header.name)}</div>` +
    (header.address ? `<div style="font-size:15px">${esc(header.address)}</div>` : '') +
    (header.phone ? `<div style="font-size:15px">${esc(header.phone)}</div>` : '') + `</div>` +
    line +
    `<div>No: ${esc(t.transaction_number)}</div>` +
    `<div>${esc(formatDateTime(t.created_at))}</div>` +
    `<div>Kasir: ${esc(t.cashier?.full_name ?? '-')}</div>` +
    `<div>Pelanggan: ${esc(t.customer?.name ?? 'Umum')}</div>` +
    line + rows + line +
    `<div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${formatRupiah(t.subtotal)}</span></div>` +
    (t.discount_amount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Diskon</span><span>-${formatRupiah(t.discount_amount)}</span></div>` : '') +
    (t.tax_amount > 0 ? `<div style="display:flex;justify-content:space-between"><span>PPN</span><span>+${formatRupiah(t.tax_amount)}</span></div>` : '') +
    (t.service_charge_amount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Service</span><span>+${formatRupiah(t.service_charge_amount)}</span></div>` : '') +
    `<div style="display:flex;justify-content:space-between;font-weight:700;font-size:19px;margin-top:3px"><span>TOTAL</span><span>${formatRupiah(t.total)}</span></div>` +
    `<div style="display:flex;justify-content:space-between"><span>${esc(PAYMENT_LABELS[t.payment_method] ?? t.payment_method)}</span><span>${formatRupiah(t.paid_amount)}</span></div>` +
    (t.payment_method === 'cash' ? `<div style="display:flex;justify-content:space-between"><span>Kembali</span><span>${formatRupiah(t.change_amount)}</span></div>` : '') +
    line +
    `<div style="text-align:center">${esc(header.footer || 'Terima kasih')}</div>`

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc) { iframe.remove(); return }
  doc.open()
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Struk</title><style>
    @page { size: 76mm auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { width: 76mm; padding: 0 3mm 3mm; color: #000; background: #fff;
      font-family: ui-monospace, "Courier New", monospace; font-size: 16px; font-weight: 700; line-height: 1.45;
      letter-spacing: 0.2px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body > *:first-child { margin-top: 0 !important; }
    body * { font-weight: 700 !important; }
  </style></head><body>${inner}</body></html>`)
  doc.close()
  const run = () => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print() } finally { setTimeout(() => iframe.remove(), 800) } }
  if (doc.readyState === 'complete') run()
  else iframe.onload = run
}
