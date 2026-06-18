'use client'

import { useState } from 'react'
import { ShoppingBag, Eye, Phone, MapPin, CheckCircle2, MessageCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { useTransactionStore } from '@/stores/use-transaction-store'
import { useProductStore } from '@/stores/use-product-store'
import { useVariantStore } from '@/stores/use-variant-store'
import { useInventoryStore } from '@/stores/use-inventory-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useStockMovementStore } from '@/stores/use-stock-movement-store'
import { useSettingsStore } from '@/stores/use-settings-store'
import { DEFAULT_OUTLET_ID } from '@/lib/supabase/config'
import { PAYMENT_LABELS } from '@/lib/constants'
import { formatRupiah, formatDateTime, waUrl } from '@/lib/utils'
import type { Transaction, TransactionStatus } from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Baru', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  completed: { label: 'Selesai', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  void: { label: 'Batal', cls: 'bg-red-100 text-red-700 border-red-200' },
  refunded: { label: 'Refund', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
}

const FILTERS: { value: 'all' | TransactionStatus; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Baru' },
  { value: 'completed', label: 'Selesai' },
  { value: 'void', label: 'Batal' },
]

export default function PesananOnlinePage() {
  const transactions = useTransactionStore((s) => s.transactions)
  const setStatus = useTransactionStore((s) => s.setStatus)
  const addMovement = useStockMovementStore((s) => s.addMovement)
  const storeName = useSettingsStore((s) => s.storeName)
  const [filter, setFilter] = useState<'all' | TransactionStatus>('all')
  const [detail, setDetail] = useState<Transaction | null>(null)

  const orders = transactions.filter((t) => t.source === 'online')
  const filtered = orders.filter((t) => filter === 'all' || t.status === filter)
  const newCount = orders.filter((t) => t.status === 'pending').length

  const complete = (t: Transaction) => { setStatus(t.id, 'completed'); toast.success('Pesanan ditandai Selesai'); setDetail(null) }

  const cancel = (t: Transaction) => {
    if (!confirm('Batalkan pesanan ini? Stok yang sempat dipotong akan dikembalikan otomatis.')) return
    // Kembalikan stok ke OUTLET pemenuhan order (yang dipotong saat order), bukan outlet aktif admin.
    const outlet = UUID_RE.test(t.outlet_id) ? t.outlet_id : DEFAULT_OUTLET_ID
    const inv = useInventoryStore.getState()
    t.items.forEach((it) => {
      const { before, after } = inv.applyDelta(outlet, it.product_id, it.variant_id, it.quantity)
      addMovement({ product_id: it.product_id, type: 'in', quantity: it.quantity, before_stock: before, after_stock: after, notes: `Pembatalan pesanan ${t.transaction_number}`, reference_id: t.id, outlet_id: outlet, created_by_name: 'Admin' })
    })
    // proyeksikan ulang stok yang ditampilkan ke outlet aktif
    const active = useActiveOutletStore.getState().activeOutletId
    useProductStore.getState().projectStock(active)
    useVariantStore.getState().projectVariantStock(active)
    setStatus(t.id, 'void')
    toast.success('Pesanan dibatalkan, stok dikembalikan')
    setDetail(null)
  }

  const waCustomer = (t: Transaction) => {
    const text = [
      `Halo ${t.customer?.name ?? 'Kak'}, terima kasih sudah pesan di *${storeName || 'AKAPACK'}*.`,
      `Pesanan *${t.transaction_number}* (${formatRupiah(t.total)}) sedang kami proses. Terima kasih.`,
    ].join('\n')
    window.open(waUrl(t.customer?.phone ?? '', text), '_blank')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingBag size={22} /> Pesanan Online</h1>
        <p className="text-muted-foreground text-sm mt-1">{orders.length} pesanan · {newCount} baru menunggu diproses</p>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <Button key={f.value} size="sm" variant={filter === f.value ? 'default' : 'outline'}
            className={cn('text-xs', filter === f.value && 'bg-primary text-primary-foreground hover:bg-primary/90')}
            onClick={() => setFilter(f.value)}>
            {f.label}{f.value === 'pending' && newCount > 0 ? ` (${newCount})` : ''}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                  {['No. Pesanan', 'Pelanggan', 'Items', 'Total', 'Waktu', 'Status', 'Aksi'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const st = STATUS[t.status] ?? STATUS.pending
                  return (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-3 px-4 font-mono text-xs font-semibold">{t.transaction_number}</td>
                      <td className="py-3 px-4">{t.customer?.name ?? 'Pelanggan'}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{t.items.length} item</td>
                      <td className="py-3 px-4 font-bold">{formatRupiah(t.total)}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{formatDateTime(t.created_at)}</td>
                      <td className="py-3 px-4"><Badge variant="outline" className={`text-xs ${st.cls}`}>{st.label}</Badge></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetail(t)}><Eye size={13} /></Button>
                          {t.status === 'pending' && (
                            <Button size="sm" className="h-7 text-xs bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => complete(t)}>Selesaikan</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-16 text-center"><ShoppingBag size={36} className="mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">Belum ada pesanan online</p></div>
            )}
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!detail} onOpenChange={() => setDetail(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detail && (
            <>
              <SheetHeader className="pb-4"><SheetTitle className="flex items-center gap-2"><ShoppingBag size={18} /> {detail.transaction_number}</SheetTitle></SheetHeader>
              <div className="space-y-5">
                <div className="rounded-xl p-4 bg-muted/50 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2"><span className="font-semibold">{detail.customer?.name ?? 'Pelanggan'}</span></div>
                  {detail.customer?.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone size={13} />{detail.customer.phone}</div>}
                  {detail.customer?.address && <div className="flex items-start gap-2 text-muted-foreground"><MapPin size={13} className="mt-0.5" />{detail.customer.address}</div>}
                  {detail.notes && <p className="text-xs text-muted-foreground pt-1">{detail.notes}</p>}
                </div>
                {detail.customer?.phone && (
                  <Button variant="outline" className="w-full gap-1.5 text-emerald-700 hover:text-emerald-700" onClick={() => waCustomer(detail)}>
                    <MessageCircle size={15} /> Hubungi via WhatsApp
                  </Button>
                )}
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Item Pesanan</p>
                  {detail.items.map((it) => (
                    <div key={it.id} className="flex justify-between text-sm py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                      <span>{it.product_name} × {it.quantity}</span>
                      <span className="font-semibold">{formatRupiah(it.subtotal)}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatRupiah(detail.subtotal)}</span></div>
                  {(detail.shipping_cost ?? 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Ongkir</span><span>{formatRupiah(detail.shipping_cost ?? 0)}</span></div>}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{formatRupiah(detail.total)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pembayaran</span><span>{detail.payment_method === 'cash' ? 'COD/Tunai' : (PAYMENT_LABELS[detail.payment_method] ?? detail.payment_method)}</span></div>
                </div>
                {detail.status === 'pending' && (
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1 text-destructive hover:text-destructive" onClick={() => cancel(detail)}>Batalkan</Button>
                    <Button className="flex-1 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => complete(detail)}><CheckCircle2 size={15} /> Selesaikan</Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
