'use client'

import { CheckCircle2, Printer, Plus, MessageCircle } from 'lucide-react'
import {
  Dialog, DialogContent, DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatRupiah, formatDateTime } from '@/lib/utils'
import { useSettingsStore } from '@/stores/use-settings-store'
import type { Transaction, PaymentMethod } from '@/types'

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  qris: 'QRIS',
  debit: 'Kartu Debit',
  credit: 'Kartu Kredit',
  transfer: 'Transfer Bank',
  ewallet: 'E-Wallet',
  split: 'Split Payment',
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Transaction | null
}

export function ReceiptModal({ open, onOpenChange, transaction }: Props) {
  const storeName = useSettingsStore((s) => s.storeName)
  const storeAddress = useSettingsStore((s) => s.storeAddress)
  const storePhone = useSettingsStore((s) => s.storePhone)
  if (!transaction) return null

  const handlePrint = () => { if (typeof window !== 'undefined') window.print() }

  const sendWhatsApp = () => {
    const t = transaction
    const lines = [
      `*${storeName || 'AKAPACK'}* — Struk Pembelian`,
      t.transaction_number,
      formatDateTime(t.created_at),
      '--------------------------------',
      ...t.items.map((it) => `${it.product_name} x${it.quantity}  ${formatRupiah(it.subtotal)}`),
      '--------------------------------',
      `Subtotal: ${formatRupiah(t.subtotal)}`,
      t.discount_amount > 0 ? `Diskon: -${formatRupiah(t.discount_amount)}` : null,
      t.tax_amount > 0 ? `PPN: +${formatRupiah(t.tax_amount)}` : null,
      t.service_charge_amount > 0 ? `Service: +${formatRupiah(t.service_charge_amount)}` : null,
      `*TOTAL: ${formatRupiah(t.total)}*`,
      `Bayar (${PAYMENT_LABELS[t.payment_method]}): ${formatRupiah(t.paid_amount)}`,
      t.payment_method === 'cash' ? `Kembalian: ${formatRupiah(t.change_amount)}` : null,
      '',
      'Terima kasih telah berbelanja 🙏',
    ]
      .filter(Boolean)
      .join('\n')
    const raw = (t.customer?.phone ?? '').replace(/\D/g, '')
    const phone = raw ? (raw.startsWith('0') ? '62' + raw.slice(1) : raw) : ''
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines)}`, '_blank')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="sr-only">Struk Transaksi</DialogTitle>

        <div className="flex flex-col items-center gap-1 pt-1">
          <div className="w-14 h-14 rounded-full flex items-center justify-center bg-emerald-100">
            <CheckCircle2 size={30} className="text-emerald-600" />
          </div>
          <p className="font-bold text-lg">Transaksi Berhasil</p>
          <p className="text-xs text-muted-foreground font-mono">{transaction.transaction_number}</p>
        </div>

        <div className="rounded-xl border bg-muted/20 p-4 font-mono text-xs space-y-2">
          <div className="text-center space-y-0.5">
            <p className="font-bold text-sm">{storeName || 'AKAPACK'}</p>
            <p className="text-muted-foreground">Struk Pembelian</p>
            <p className="text-muted-foreground">{formatDateTime(transaction.created_at)}</p>
          </div>

          <Separator />

          <div className="space-y-1">
            {transaction.items.map((it) => (
              <div key={it.id} className="flex justify-between gap-2">
                <span className="truncate">{it.product_name} ×{it.quantity}</span>
                <span className="shrink-0">{formatRupiah(it.subtotal)}</span>
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-0.5">
            <Row label="Subtotal" value={formatRupiah(transaction.subtotal)} />
            {transaction.discount_amount > 0 && <Row label="Diskon" value={`-${formatRupiah(transaction.discount_amount)}`} />}
            {transaction.tax_amount > 0 && <Row label="PPN" value={`+${formatRupiah(transaction.tax_amount)}`} />}
            {transaction.service_charge_amount > 0 && <Row label="Service" value={`+${formatRupiah(transaction.service_charge_amount)}`} />}
            <div className="flex justify-between font-bold text-sm pt-0.5">
              <span>TOTAL</span><span>{formatRupiah(transaction.total)}</span>
            </div>
            <Row label={PAYMENT_LABELS[transaction.payment_method]} value={formatRupiah(transaction.paid_amount)} />
            {transaction.payment_method === 'cash' && <Row label="Kembalian" value={formatRupiah(transaction.change_amount)} />}
          </div>

          <Separator />

          <div className="text-center text-muted-foreground space-y-0.5">
            <p>{transaction.customer?.name ?? 'Pelanggan Umum'} · Kasir: {transaction.cashier?.full_name ?? '-'}</p>
            <p>Terima kasih telah berbelanja 🙏</p>
          </div>
        </div>

        <div className="space-y-2">
          <Button className="w-full gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" onClick={sendWhatsApp}>
            <MessageCircle size={15} /> Kirim Struk via WhatsApp
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-1.5" onClick={handlePrint}>
              <Printer size={15} /> Cetak
            </Button>
            <Button className="flex-1 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => onOpenChange(false)}>
              <Plus size={15} /> Transaksi Baru
            </Button>
          </div>
        </div>

        {/* Versi cetak — bersih untuk printer struk Epson TM-U220D (dot-matrix, 76mm). Tersembunyi di layar. */}
        <div id="receipt-print" className="hidden print:block" style={{ fontFamily: 'ui-monospace, monospace', color: '#000', fontSize: 12, lineHeight: 1.45 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{storeName || 'AKAPACK'}</div>
            {storeAddress && <div>{storeAddress}</div>}
            {storePhone && <div>{storePhone}</div>}
          </div>
          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
          <div>No: {transaction.transaction_number}</div>
          <div>{formatDateTime(transaction.created_at)}</div>
          <div>Kasir: {transaction.cashier?.full_name ?? '-'}</div>
          <div>Pelanggan: {transaction.customer?.name ?? 'Umum'}</div>
          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
          {transaction.items.map((it) => (
            <div key={it.id} style={{ marginBottom: 3 }}>
              <div>{it.product_name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{it.quantity} x {formatRupiah(it.product_price)}</span>
                <span>{formatRupiah(it.subtotal)}</span>
              </div>
            </div>
          ))}
          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{formatRupiah(transaction.subtotal)}</span></div>
          {transaction.discount_amount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Diskon</span><span>-{formatRupiah(transaction.discount_amount)}</span></div>}
          {transaction.tax_amount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>PPN</span><span>+{formatRupiah(transaction.tax_amount)}</span></div>}
          {transaction.service_charge_amount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Service</span><span>+{formatRupiah(transaction.service_charge_amount)}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13, marginTop: 3 }}><span>TOTAL</span><span>{formatRupiah(transaction.total)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{PAYMENT_LABELS[transaction.payment_method]}</span><span>{formatRupiah(transaction.paid_amount)}</span></div>
          {transaction.payment_method === 'cash' && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Kembali</span><span>{formatRupiah(transaction.change_amount)}</span></div>}
          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
          <div style={{ textAlign: 'center' }}>Terima kasih</div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
