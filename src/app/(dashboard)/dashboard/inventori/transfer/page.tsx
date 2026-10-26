'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeftRight, ArrowLeft, Plus, X, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOutletStore } from '@/stores/use-outlet-store'
import { useProductStore } from '@/stores/use-product-store'
import { useInventoryStore } from '@/stores/use-inventory-store'
import { newMovementId, describeStockError } from '@/lib/stock/stock-sync'
import { ProductCombobox } from '@/components/dashboard/product-combobox'
import { toast } from 'sonner'

type Line = { product_id: string; qty: number }

export default function TransferStokPage() {
  const outlets = useOutletStore((s) => s.outlets)
  const products = useProductStore((s) => s.products)
  const invItems = useInventoryStore((s) => s.items)
  const [busy, setBusy] = useState(false)

  const [fromId, setFromId] = useState(outlets[0]?.id ?? '')
  const [toId, setToId] = useState(outlets[1]?.id ?? '')
  const [items, setItems] = useState<Line[]>([{ product_id: '', qty: 1 }])

  const fromName = outlets.find((o) => o.id === fromId)?.name ?? ''
  const toName = outlets.find((o) => o.id === toId)?.name ?? ''

  // stok di outlet asal (reaktif terhadap perubahan inventory)
  const stockAtFrom = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of invItems) if (r.outlet_id === fromId && !r.variant_id) map.set(r.product_id, r.stock)
    return map
  }, [invItems, fromId])

  const setItem = (i: number, patch: Partial<Line>) => setItems((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const addLine = () => setItems((ls) => [...ls, { product_id: '', qty: 1 }])
  const removeLine = (i: number) => setItems((ls) => (ls.length <= 1 ? ls : ls.filter((_, idx) => idx !== i)))

  const process = async () => {
    if (busy) return
    if (!fromId || !toId) { toast.error('Pilih outlet asal & tujuan'); return }
    if (fromId === toId) { toast.error('Outlet asal & tujuan harus berbeda'); return }
    const valid = items.filter((i) => i.product_id && i.qty > 0)
    if (!valid.length) { toast.error('Tambah minimal 1 produk dengan qty'); return }
    // Agregasi qty per produk (cegah baris dobel bikin over-transfer/stok hantu)
    const agg = new Map<string, number>()
    for (const it of valid) agg.set(it.product_id, (agg.get(it.product_id) ?? 0) + it.qty)
    for (const [pid, qty] of agg) {
      const avail = stockAtFrom.get(pid) ?? 0
      if (qty > avail) {
        const nm = products.find((p) => p.id === pid)?.name ?? 'Produk'
        toast.error(`Stok ${nm} di ${fromName} cuma ${avail} (diminta ${qty})`); return
      }
    }
    // SATU panggilan untuk kedua sisi: server mengurangi asal & menambah tujuan dalam satu transaksi,
    // menolak bila stok asal SEBENARNYA kurang (bukan angka di memori), dan mencatat riwayat dengan
    // angka asli. Dulu dua kiriman terpisah + label dari memori (Math.max(0, …)) → riwayat meleset.
    // Pasangan baris berurutan & potongan 200 = genap → kedua sisi satu produk tak pernah terpisah.
    const transferId = newMovementId()
    const at = new Date().toISOString()
    const lines = [...agg].flatMap(([pid, qty]) => [
      { id: newMovementId(), outlet_id: fromId, product_id: pid, delta: -qty, type: 'transfer' as const,
        notes: `Transfer ke ${toName}`, reference_id: transferId, created_at: at, allow_negative: false },
      { id: newMovementId(), outlet_id: toId, product_id: pid, delta: qty, type: 'transfer' as const,
        notes: `Transfer dari ${fromName}`, reference_id: transferId, created_at: at },
    ])
    setBusy(true)
    const { failed } = await useInventoryStore.getState().applyStockNow(lines)
    setBusy(false)
    if (failed.length) {
      const f = failed[0]
      toast.error(`Transfer GAGAL — tidak ada stok yang dipindah. ${describeStockError(f.code, f.message)}`, { duration: 12000 })
      return
    }
    toast.success(`Transfer ${agg.size} produk: ${fromName} → ${toName}`)
    setItems([{ product_id: '', qty: 1 }])
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/inventori" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"><ArrowLeft size={13} /> Inventori</Link>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ArrowLeftRight size={22} /> Transfer Stok Antar-Outlet</h1>
        <p className="text-muted-foreground text-sm mt-1">Pindahkan stok dari satu cabang ke cabang lain</p>
      </div>

      <Card className="max-w-3xl">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            <div className="space-y-2">
              <Label>Dari Outlet</Label>
              <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <ArrowRight size={18} className="mb-2 text-muted-foreground" />
            <div className="space-y-2">
              <Label>Ke Outlet</Label>
              <select value={toId} onChange={(e) => setToId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center text-xs font-semibold text-muted-foreground px-1">
              <span className="flex-1">Produk</span><span className="w-28 text-right">Stok di {fromName || 'asal'}</span><span className="w-20 text-right">Qty</span><span className="w-8" />
            </div>
            {items.map((it, i) => {
              const avail = stockAtFrom.get(it.product_id) ?? 0
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <ProductCombobox products={products} value={it.product_id} onChange={(pid) => setItem(i, { product_id: pid })} placeholder="Pilih produk…" />
                  </div>
                  <span className={`w-28 text-right text-sm tabular-nums ${it.product_id && it.qty > avail ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>{it.product_id ? avail : '—'}</span>
                  <Input type="number" min={1} className="w-20 text-right" value={it.qty || ''} onChange={(e) => setItem(i, { qty: Math.max(0, Number(e.target.value)) })} />
                  <button type="button" onClick={() => removeLine(i)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30" disabled={items.length <= 1}><X size={14} /></button>
                </div>
              )
            })}
            <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={addLine}><Plus size={13} /> Tambah Produk</Button>
          </div>

          <Button onClick={process} disabled={busy} className="w-full gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"><ArrowLeftRight size={16} /> {busy ? 'Memproses…' : 'Proses Transfer'}</Button>
        </CardContent>
      </Card>
    </div>
  )
}
