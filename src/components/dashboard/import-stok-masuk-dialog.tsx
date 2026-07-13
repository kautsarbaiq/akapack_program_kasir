'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, PackagePlus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useProductStore } from '@/stores/use-product-store'
import { usePurchaseStore } from '@/stores/use-purchase-store'
import { useInventoryStore } from '@/stores/use-inventory-store'
import { useVariantStore } from '@/stores/use-variant-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useOutletStore } from '@/stores/use-outlet-store'
import { useStockMovementStore } from '@/stores/use-stock-movement-store'
import { useCurrentUserStore } from '@/stores/use-current-user-store'
import { generateId } from '@/lib/utils'
import type { PurchaseOrder, PurchaseItem } from '@/types'
import { toast } from 'sonner'

// Satu baris Excel = satu item; dokumen dikelompokkan oleh kolom 'dokumen' bila ada,
// kalau tidak by (tanggal + catatan + diterima_dari).
const DOC_KEYS = ['dokumen', 'no', 'no_stok_masuk', 'no stok masuk', 'group', 'grup']
const DATE_KEYS = ['tanggal', 'date', 'tgl']
const NOTE_KEYS = ['catatan', 'note', 'keterangan']
const FROM_KEYS = ['diterima_dari', 'diterima dari', 'sumber', 'received_from']
const SKU_KEYS = ['sku', 'kode', 'kode produk']
const NAME_KEYS = ['produk', 'nama', 'name', 'nama produk', 'product']
const QTY_KEYS = ['qty', 'jumlah', 'quantity', 'stock_qty', 'kuantitas']
const COST_KEYS = ['harga_beli', 'harga beli', 'buy_price', 'harga', 'cost', 'modal']

function pickKey(obj: Record<string, unknown>, names: string[]) {
  for (const k of Object.keys(obj)) if (names.includes(k.toLowerCase().trim())) return k
  return null
}
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? Math.max(0, n) : 0 }

function genIN(dateStr: string, seq: number) {
  const parsed = new Date(dateStr || Date.now())
  const d = Number.isNaN(parsed.getTime()) ? new Date() : parsed // tanggal non-ISO → hari ini
  const yy = String(d.getFullYear()).slice(-2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `IN${yy}${mm}${dd}${String(seq).padStart(8, '0')}`
}

type ParsedItem = { sku: string; name: string; qty: number; cost: number }
type ParsedDoc = { key: string; date: string; note: string; from: string; items: ParsedItem[] }

export function ImportStokMasukDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const products = useProductStore((s) => s.products)
  const outlets = useOutletStore((s) => s.outlets)
  const activeOutletId = useActiveOutletStore((s) => s.activeOutletId)
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [docs, setDocs] = useState<ParsedDoc[] | null>(null)
  const [busy, setBusy] = useState(false)
  // Cabang tujuan stok — EKSPLISIT dipilih (default cabang aktif), sama seperti form manual.
  const [targetOutletId, setTargetOutletId] = useState(activeOutletId)
  useEffect(() => { if (open) setTargetOutletId(activeOutletId) }, [open, activeOutletId])

  const bySku = useMemo(() => {
    const m = new Map<string, (typeof products)[number]>()
    for (const p of products) if (p.sku) m.set(p.sku.trim().toLowerCase(), p)
    return m
  }, [products])
  const byName = useMemo(() => {
    const m = new Map<string, (typeof products)[number]>()
    for (const p of products) m.set(p.name.trim().toLowerCase(), p)
    return m
  }, [products])
  const match = (it: ParsedItem) => (it.sku && bySku.get(it.sku.toLowerCase())) || byName.get(it.name.toLowerCase())

  const totalItems = docs?.reduce((s, d) => s + d.items.length, 0) ?? 0
  const matchedItems = docs?.reduce((s, d) => s + d.items.filter((it) => match(it)).length, 0) ?? 0

  const reset = () => { setDocs(null); setFileName(''); if (fileRef.current) fileRef.current.value = '' }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    try {
      // cellDates: sel tanggal Excel jadi Date (bukan angka serial 45xxx) → parse tanggal benar.
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      if (!json.length) { toast.error('File kosong'); return }
      const k = {
        doc: pickKey(json[0], DOC_KEYS), date: pickKey(json[0], DATE_KEYS), note: pickKey(json[0], NOTE_KEYS),
        from: pickKey(json[0], FROM_KEYS), sku: pickKey(json[0], SKU_KEYS), name: pickKey(json[0], NAME_KEYS),
        qty: pickKey(json[0], QTY_KEYS), cost: pickKey(json[0], COST_KEYS),
      }
      if (!k.name && !k.sku) { toast.error('Kolom produk (nama / sku) tidak ditemukan'); return }
      if (!k.qty) { toast.error('Kolom qty tidak ditemukan'); return }
      const get = (o: Record<string, unknown>, key: string | null) => (key ? String(o[key] ?? '').trim() : '')
      const groups = new Map<string, ParsedDoc>()
      for (const o of json) {
        const name = get(o, k.name)
        const sku = get(o, k.sku)
        if (!name && !sku) continue
        const date = get(o, k.date)
        const note = get(o, k.note)
        const from = get(o, k.from)
        const gkey = k.doc ? get(o, k.doc) : `${date}|${note}|${from}`
        let g = groups.get(gkey)
        if (!g) { g = { key: gkey, date, note, from, items: [] }; groups.set(gkey, g) }
        g.items.push({ sku, name, qty: Math.round(num(get(o, k.qty))), cost: num(get(o, k.cost)) })
      }
      const list = [...groups.values()].filter((d) => d.items.length)
      if (!list.length) { toast.error('Tidak ada dokumen valid'); return }
      setDocs(list)
      toast.success(`${list.length} dokumen terbaca (${json.length} baris)`)
    } catch (err) {
      console.warn(err)
      toast.error('Gagal membaca file. Pastikan .xlsx / .csv valid')
    }
  }

  const apply = async () => {
    if (!docs?.length) return
    setBusy(true)
    try {
      const ps = usePurchaseStore.getState()
      const prodStore = useProductStore.getState()
      const inv = useInventoryStore.getState()
      const outlet = targetOutletId // cabang tujuan yang DIPILIH, bukan diam-diam cabang aktif
      const me = useCurrentUserStore.getState().user?.email || useCurrentUserStore.getState().user?.name || 'Import'
      // Urutan nomor dari MAX nomor yang ada (bukan panjang array) → tak bentrok walau ada dokumen terhapus.
      let base = ps.purchases.reduce((mx, p) => {
        const m = /(\d{8})$/.exec(p.number || '')
        return m ? Math.max(mx, parseInt(m[1], 10)) : mx
      }, 0)
      let createdDocs = 0
      let skipped = 0
      // Akumulasi delta stok & nilai per-produk (lintas semua dokumen) → 1x batch ke DB.
      const acc = new Map<string, { qty: number; costSum: number; costQty: number }>()

      for (const d of docs) {
        const poId = generateId('po')
        const poItems: PurchaseItem[] = []
        for (const it of d.items) {
          const prod = match(it)
          if (!prod || it.qty <= 0) { skipped++; continue } // qty 0 dilewati (samakan dgn form manual)
          poItems.push({ id: generateId('poi'), purchase_id: poId, product_id: prod.id, product_name: prod.name, qty: it.qty, cost: it.cost, subtotal: it.qty * it.cost })
          const a = acc.get(prod.id) ?? { qty: 0, costSum: 0, costQty: 0 }
          a.qty += it.qty
          // Moving-average hanya dari baris yang PUNYA harga beli (cost>0) — file tanpa kolom harga
          // tidak boleh mengencerkan/menolkan modal produk.
          if (it.cost > 0) { a.costSum += it.qty * it.cost; a.costQty += it.qty }
          acc.set(prod.id, a)
        }
        if (!poItems.length) continue
        base += 1
        // Parse tanggal defensif: format non-ISO (mis. "13/06/2026") tidak boleh melempar RangeError
        // di tengah loop (dokumen awal tersimpan tapi stok batal masuk = import setengah jalan).
        const parsed = d.date ? new Date(d.date) : new Date()
        const isoDate = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
        const po: PurchaseOrder = {
          id: poId, number: genIN(d.date, base), outlet_id: outlet, supplier_id: undefined, supplier: undefined,
          items: poItems, total: poItems.reduce((s, i) => s + i.subtotal, 0),
          status: 'received', payment: 'credit', paid: false,
          notes: d.note || undefined, received_from: d.from || undefined, received_by: me,
          date: isoDate, received_at: new Date().toISOString(), created_at: new Date().toISOString(),
        }
        ps.addPurchase(po)
        createdDocs++
      }

      // Posting massal: tambah stok (current + delta) + moving-average cost, dalam batch.
      const stockEntries: { productId: string; stock: number }[] = []
      const costPatches: { id: string; cost_price: number }[] = []
      const mv = useStockMovementStore.getState()
      for (const [pid, a] of acc) {
        const prod = prodStore.products.find((p) => p.id === pid)
        const before = inv.stockAt(outlet, pid) ?? prod?.stock ?? 0
        stockEntries.push({ productId: pid, stock: before + a.qty })
        // Jejak audit: catat pergerakan 'in' per produk (samakan dgn posting manual).
        mv.addMovement({ product_id: pid, type: 'in', quantity: a.qty, before_stock: before, after_stock: before + a.qty, notes: 'Import Stok Masuk', created_by_name: me, outlet_id: outlet })
        // Update modal HANYA bila ada harga beli di file (costSum>0) — jangan menolkan modal.
        if (a.costSum > 0 && a.costQty > 0) {
          const beforeCost = prod?.cost_price ?? 0
          // Bobot rata-rata pakai stok lama ter-clamp ≥0 (stok minus tak boleh menyeret modal).
          const wBefore = Math.max(0, before)
          const denom = wBefore + a.costQty
          const newCost = denom > 0 ? Math.round((wBefore * beforeCost + a.costSum) / denom) : Math.round(a.costSum / a.costQty)
          costPatches.push({ id: pid, cost_price: newCost })
        }
      }
      let failed = 0
      if (stockEntries.length) failed += await inv.bulkUpsert(outlet, stockEntries)
      if (costPatches.length) failed += await prodStore.bulkPatch(costPatches)
      // Proyeksikan tampilan ke CABANG AKTIF (bukan cabang tujuan) — import ke Garut saat melihat
      // Bandung tidak boleh menukar seluruh angka stok layar ke milik Garut.
      const viewOutlet = useActiveOutletStore.getState().activeOutletId
      prodStore.projectStock(viewOutlet)
      useVariantStore.getState().projectVariantStock(viewOutlet)

      const tail = skipped > 0 ? ` (${skipped} item dilewati — produk tak ada di katalog)` : ''
      if (failed > 0) toast.warning(`${createdDocs} dokumen dibuat, tapi ${failed} update stok GAGAL ke server — muat ulang & cek.${tail}`)
      else toast.success(`${createdDocs} dokumen Stok Masuk dibuat — stok ${outlets.find((o) => o.id === targetOutletId)?.name ?? 'cabang'} bertambah${tail}`)
      reset()
      onOpenChange(false)
    } catch (e) {
      console.warn(e)
      toast.error('Gagal mengimpor')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><PackagePlus size={18} /> Import Stok Masuk (banyak dokumen)</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border bg-amber-50/50 px-3 py-2">
            <span className="text-xs font-semibold whitespace-nowrap">Cabang Tujuan Stok:</span>
            <select value={targetOutletId} onChange={(e) => setTargetOutletId(e.target.value)}
              className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring">
              {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
          {!docs ? (
            <button onClick={() => fileRef.current?.click()} className="w-full rounded-xl border-2 border-dashed py-10 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-muted/30 transition-colors">
              <Upload size={28} className="text-muted-foreground" />
              <p className="text-sm font-medium">Pilih file .xlsx / .csv</p>
              <p className="text-xs text-muted-foreground text-center max-w-sm">Kolom: <span className="font-mono">tanggal, catatan, diterima_dari, sku / nama, qty, harga_beli</span>. Baris dikelompokkan jadi dokumen by kolom <span className="font-mono">dokumen</span> (kalau ada) atau by tanggal+catatan. Semua langsung di-Posting (stok bertambah).</p>
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 truncate"><FileSpreadsheet size={15} className="text-emerald-600 shrink-0" /> {fileName}</span>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={reset}>Ganti</Button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/40 p-2"><p className="text-lg font-bold">{docs.length}</p><p className="text-xs text-muted-foreground">Dokumen</p></div>
                <div className="rounded-lg bg-emerald-50 p-2"><p className="text-lg font-bold text-emerald-700">{matchedItems}</p><p className="text-xs text-muted-foreground">Item cocok</p></div>
                <div className="rounded-lg bg-amber-50 p-2"><p className="text-lg font-bold text-amber-700">{totalItems - matchedItems}</p><p className="text-xs text-muted-foreground">Tak cocok</p></div>
              </div>
              {totalItems - matchedItems > 0 && <p className="text-xs text-amber-600">Item yang produknya tidak ada di katalog akan dilewati. Pastikan SKU/nama sesuai katalog.</p>}
              <div className="max-h-48 overflow-y-auto rounded-lg border text-xs">
                {docs.slice(0, 40).map((d, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                    <span className="truncate pr-2">{d.date || '—'} · {d.note || d.key}</span>
                    <span className="tabular-nums text-muted-foreground shrink-0">{d.items.length} item</span>
                  </div>
                ))}
                {docs.length > 40 && <p className="text-center text-muted-foreground py-2">…dan {docs.length - 40} dokumen lagi</p>}
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Tutup</Button>
          <Button onClick={apply} disabled={!docs || busy || matchedItems === 0} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
            {busy ? <><Loader2 size={15} className="animate-spin" /> Memproses…</> : <><CheckCircle2 size={15} /> Import & Posting</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
