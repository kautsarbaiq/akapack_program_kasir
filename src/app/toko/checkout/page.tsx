'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ArrowLeft, Loader2, ShoppingBag, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useStoreCart } from '@/stores/use-store-cart'
import { useCustomerStore } from '@/stores/use-customer-store'
import { useTransactionStore } from '@/stores/use-transaction-store'
import { useProductStore } from '@/stores/use-product-store'
import { useVariantStore } from '@/stores/use-variant-store'
import { useInventoryStore } from '@/stores/use-inventory-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useStockMovementStore } from '@/stores/use-stock-movement-store'
import { useSettingsStore } from '@/stores/use-settings-store'
import { DEFAULT_OUTLET_ID } from '@/lib/supabase/config'
import { formatRupiah, generateId, generateTransactionNumber, waUrl, cn } from '@/lib/utils'
import type { Transaction, TransactionItem, PaymentMethod } from '@/types'
import { toast } from 'sonner'

// Channel online selalu dipenuhi dari outlet Pusat (tetap), bukan outlet aktif per-browser.
const ONLINE_OUTLET = DEFAULT_OUTLET_ID

export default function CheckoutPage() {
  const items = useStoreCart((s) => s.items)
  const clear = useStoreCart((s) => s.clear)
  const addCustomer = useCustomerStore((s) => s.addCustomer)
  const addTransaction = useTransactionStore((s) => s.addTransaction)
  const addMovement = useStockMovementStore((s) => s.addMovement)
  const storeName = useSettingsStore((s) => s.storeName)
  const waNumber = useSettingsStore((s) => s.waNumber)
  const bankInfo = useSettingsStore((s) => s.bankInfo)
  const shippingFlat = useSettingsStore((s) => s.shippingFlat)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [method, setMethod] = useState<'transfer' | 'cod'>('transfer')
  const [delivery, setDelivery] = useState<'kirim' | 'pickup'>('kirim')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<Transaction | null>(null)

  const itemsTotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const shipping = delivery === 'kirim' ? shippingFlat : 0
  const total = itemsTotal + shipping

  const submit = async () => {
    if (!name.trim() || !phone.trim()) { toast.error('Nama & No. HP wajib diisi'); return }
    if (items.length === 0) return
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 500))

    const customer = addCustomer({ name: name.trim(), phone: phone.trim(), email: '', address: address.trim(), points: 0 })
    const txnId = generateId('trx')
    const txnItems: TransactionItem[] = items.map((i) => ({
      id: generateId('item'),
      transaction_id: txnId,
      product_id: i.product_id,
      variant_id: i.variant_id,
      product_name: i.name,
      product_price: i.price,
      quantity: i.quantity,
      discount: 0,
      subtotal: i.price * i.quantity,
    }))
    const pm: PaymentMethod = method === 'cod' ? 'cash' : 'transfer_bca'
    const txn: Transaction = {
      id: txnId,
      outlet_id: ONLINE_OUTLET,
      transaction_number: generateTransactionNumber(),
      customer_id: customer.id,
      customer,
      cashier_id: '',
      items: txnItems,
      subtotal: itemsTotal,
      discount_amount: 0,
      tax_amount: 0,
      service_charge_amount: 0,
      shipping_cost: shipping,
      total,
      paid_amount: method === 'cod' ? 0 : total,
      change_amount: 0,
      payment_method: pm,
      source: 'online',
      notes: `Pesanan Online · ${delivery === 'kirim' ? 'Dikirim' : 'Ambil di toko'} · ${method === 'cod' ? 'COD' : 'Transfer'}`,
      status: 'pending',
      created_at: new Date().toISOString(),
    }
    addTransaction(txn)
    // Stok dipotong saat order (reservasi); pesanan mulai berstatus "pending" sampai dikonfirmasi admin.
    const inv = useInventoryStore.getState()
    items.forEach((i) => {
      const { before, after } = inv.applyDelta(ONLINE_OUTLET, i.product_id, i.variant_id, -i.quantity)
      addMovement({ product_id: i.product_id, type: 'out', quantity: -i.quantity, before_stock: before, after_stock: after, notes: i.variant_id ? `Online (${i.name})` : 'Pesanan Online', reference_id: txnId, outlet_id: ONLINE_OUTLET, created_by_name: 'Online Store' })
    })
    // proyeksikan ulang stok yang ditampilkan ke outlet aktif visitor
    const active = useActiveOutletStore.getState().activeOutletId
    useProductStore.getState().projectStock(active)
    useVariantStore.getState().projectVariantStock(active)
    clear()
    setSuccess(txn)
    setSubmitting(false)
  }

  if (success) {
    const waText = [
      `Halo *${storeName || 'AKAPACK'}*, saya mau konfirmasi pesanan:`,
      '',
      `No. Pesanan: ${success.transaction_number}`,
      `Nama: ${name}`,
      `No. HP: ${phone}`,
      delivery === 'kirim' ? `Alamat: ${address || '-'}` : 'Ambil di toko',
      '--------------------------------',
      ...success.items.map((it) => `• ${it.product_name} x${it.quantity} — ${formatRupiah(it.subtotal)}`),
      '--------------------------------',
      `Subtotal: ${formatRupiah(success.subtotal)}`,
      shipping > 0 ? `Ongkir: ${formatRupiah(shipping)}` : null,
      `*Total: ${formatRupiah(success.total)}*`,
      `Pembayaran: ${method === 'cod' ? 'COD (bayar di tempat)' : 'Transfer Bank'}`,
      '',
      'Terima kasih',
    ]
      .filter(Boolean)
      .join('\n')

    return (
      <div className="max-w-md mx-auto text-center space-y-4 py-10">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <CheckCircle2 size={34} className="text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Pesanan Diterima!</h1>
          <p className="text-sm text-muted-foreground">No. Pesanan <span className="font-mono">{success.transaction_number}</span></p>
        </div>
        <div className="rounded-xl border bg-background p-4 text-sm space-y-1 text-left">
          <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold">{formatRupiah(success.total)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Pembayaran</span><span>{method === 'cod' ? 'COD (bayar di tempat)' : 'Transfer Bank'}</span></div>
          {method === 'transfer' && (
            bankInfo.trim() ? (
              <div className="pt-2 mt-1 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-1">Silakan transfer ke:</p>
                <pre className="text-xs whitespace-pre-wrap font-sans">{bankInfo}</pre>
                <p className="text-xs text-muted-foreground pt-1.5">Setelah transfer, konfirmasi via WhatsApp di bawah.</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground pt-2">Silakan konfirmasi via WhatsApp untuk info rekening & pembayaran.</p>
            )
          )}
          {method === 'cod' && <p className="text-xs text-muted-foreground pt-2">Bayar saat barang tiba. Tim kami akan menghubungi Anda.</p>}
        </div>
        <a href={waUrl(waNumber, waText)} target="_blank" rel="noopener noreferrer" className="block">
          <Button className="w-full gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700">
            <MessageCircle size={16} /> Konfirmasi via WhatsApp
          </Button>
        </a>
        <Link href="/toko"><Button variant="outline" className="w-full">Belanja Lagi</Button></Link>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <ShoppingBag size={40} className="mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">Keranjang masih kosong</p>
        <Link href="/toko" className="text-primary text-sm inline-flex items-center gap-1"><ArrowLeft size={14} /> Mulai belanja</Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link href="/toko" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Lanjut belanja</Link>
      <h1 className="text-2xl font-bold">Checkout</h1>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-2"><Label>Nama Penerima *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" className="bg-background" /></div>
          <div className="space-y-2"><Label>No. WhatsApp *</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" className="bg-background" /></div>
          <div className="space-y-2">
            <Label>Alamat Pengiriman</Label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Alamat lengkap (kosongkan jika ambil di toko)"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[70px] resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-2">
            <Label>Pengiriman</Label>
            <div className="grid grid-cols-2 gap-2">
              {([['kirim', 'Dikirim (+ongkir)'], ['pickup', 'Ambil di Toko']] as const).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setDelivery(val)}
                  className={cn('py-2.5 rounded-lg border text-sm font-medium', delivery === val ? 'border-primary bg-primary/5 text-primary' : 'bg-background')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Metode Pembayaran</Label>
            <div className="grid grid-cols-2 gap-2">
              {([['transfer', 'Transfer Bank'], ['cod', 'COD / Bayar di Tempat']] as const).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setMethod(val)}
                  className={cn('py-2.5 rounded-lg border text-sm font-medium', method === val ? 'border-primary bg-primary/5 text-primary' : 'bg-background')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ringkasan */}
        <div className="space-y-3">
          <div className="rounded-xl border bg-background p-4 space-y-2">
            <p className="font-semibold text-sm">Ringkasan Pesanan</p>
            {items.map((i) => (
              <div key={i.key} className="flex justify-between text-sm">
                <span className="text-muted-foreground truncate pr-2">{i.name} × {i.quantity}</span>
                <span>{formatRupiah(i.price * i.quantity)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatRupiah(itemsTotal)}</span></div>
            {shipping > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Ongkir</span><span>{formatRupiah(shipping)}</span></div>}
            <div className="border-t pt-2 flex justify-between font-bold"><span>Total</span><span className="text-lg">{formatRupiah(total)}</span></div>
          </div>
          <Button className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5" onClick={submit} disabled={submitting}>
            {submitting && <Loader2 size={16} className="animate-spin" />} Buat Pesanan
          </Button>
        </div>
      </div>
    </div>
  )
}
