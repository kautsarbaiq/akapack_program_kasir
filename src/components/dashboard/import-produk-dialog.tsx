'use client'

import { useState, useRef, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, Boxes, Tag, Image as ImageIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useProductStore, type BulkProductInput, type ProductPatch } from '@/stores/use-product-store'
import { useInventoryStore } from '@/stores/use-inventory-store'
import { useCategoryStore } from '@/stores/use-category-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useVariantStore } from '@/stores/use-variant-store'
import { useOutletStore } from '@/stores/use-outlet-store'
import { formatRupiah } from '@/lib/utils'
import { toast } from 'sonner'

type CatRow = {
  name: string
  category: string
  sku: string
  barcode: string
  cost: number
  price: number
  priceOnline: number
  stock: number
  unit: string
  description: string
  image: string
  active: boolean
}

// Pemetaan kolom — mendukung format ekspor Olsera + header generik (ID/EN)
const NAME_KEYS = ['name', 'nama', 'nama produk', 'product', 'produk']
const CAT_KEYS = ['category', 'kategori', 'classification', 'klasifikasi']
const SKU_KEYS = ['sku', 'kode', 'kode produk', 'product code']
const BARCODE_KEYS = ['barcode', 'kode batang', 'ean']
const BUY_KEYS = ['buy_price', 'harga beli', 'modal', 'harga modal', 'cost', 'cost_price', 'hpp']
const POS_PRICE_KEYS = ['pos_sell_price', 'harga jual', 'harga', 'price', 'sell_price', 'market_price', 'harga jual pos']
const ONLINE_PRICE_KEYS = ['sell_price', 'market_price', 'harga online', 'price_online', 'harga web']
const QTY_KEYS = ['stock_qty', 'stock', 'stok', 'qty', 'jumlah', 'quantity']
const UOM_KEYS = ['uom', 'unit', 'satuan', 'unit of measure']
const DESC_KEYS = ['description', 'deskripsi', 'keterangan', 'notes', 'catatan']
const PHOTO_KEYS = ['photo_1', 'photo', 'image', 'foto', 'gambar', 'image_url', 'photo1']
const PUBLISHED_KEYS = ['published', 'aktif', 'is_active', 'status', 'active']

function pickKey(obj: Record<string, unknown>, names: string[]) {
  for (const k of Object.keys(obj)) if (names.includes(k.toLowerCase().trim())) return k
  return null
}
function num(v: unknown): number {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? Math.max(0, n) : 0
}
function truthy(v: unknown): boolean {
  const s = String(v ?? '').trim().toLowerCase()
  if (s === '') return true // default aktif kalau kolom kosong/tidak ada
  return !['0', 'false', 'no', 'tidak', 'nonaktif', 'inactive', 'unpublished', 'hidden', 'draft'].includes(s)
}

export function ImportProdukDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const products = useProductStore((s) => s.products)
  const bulkAdd = useProductStore((s) => s.bulkAdd)
  const bulkPatch = useProductStore((s) => s.bulkPatch)
  const ensureCategories = useCategoryStore((s) => s.ensureCategories)
  const activeOutletId = useActiveOutletStore((s) => s.activeOutletId)
  const outlets = useOutletStore((s) => s.outlets)

  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<CatRow[] | null>(null)
  const [updateExisting, setUpdateExisting] = useState(false)
  const [outletId, setOutletId] = useState(activeOutletId)
  const [busy, setBusy] = useState(false)

  // Dedupe dalam-file: prioritas SKU, fallback nama (baris pertama menang)
  const aggRows = useMemo(() => {
    if (!rows) return [] as CatRow[]
    const m = new Map<string, CatRow>()
    for (const r of rows) {
      const key = r.sku ? `sku:${r.sku.toLowerCase()}` : `name:${r.name.toLowerCase()}`
      if (!m.has(key)) m.set(key, r)
    }
    return [...m.values()]
  }, [rows])

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
  const findExisting = (r: CatRow) => (r.sku && bySku.get(r.sku.toLowerCase())) || byName.get(r.name.toLowerCase())

  const matchedCount = aggRows.filter((r) => findExisting(r)).length
  const newCount = aggRows.length - matchedCount
  const newCats = useMemo(() => {
    const existing = new Set(useCategoryStore.getState().categories.map((c) => c.name.trim().toLowerCase()))
    const fresh = new Set<string>()
    for (const r of aggRows) {
      const c = r.category.trim()
      if (c && !existing.has(c.toLowerCase())) fresh.add(c.toLowerCase())
    }
    return fresh.size
  }, [aggRows])

  const reset = () => { setRows(null); setFileName(''); if (fileRef.current) fileRef.current.value = '' }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      // Cari sheet 'product' kalau ada (ekspor Olsera), kalau tidak pakai sheet pertama
      const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes('product')) ?? wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      if (!json.length) { toast.error('File kosong'); return }
      const k = {
        name: pickKey(json[0], NAME_KEYS),
        cat: pickKey(json[0], CAT_KEYS),
        sku: pickKey(json[0], SKU_KEYS),
        barcode: pickKey(json[0], BARCODE_KEYS),
        buy: pickKey(json[0], BUY_KEYS),
        pos: pickKey(json[0], POS_PRICE_KEYS),
        online: pickKey(json[0], ONLINE_PRICE_KEYS),
        qty: pickKey(json[0], QTY_KEYS),
        uom: pickKey(json[0], UOM_KEYS),
        desc: pickKey(json[0], DESC_KEYS),
        photo: pickKey(json[0], PHOTO_KEYS),
        pub: pickKey(json[0], PUBLISHED_KEYS),
      }
      if (!k.name) { toast.error('Kolom nama produk tidak ditemukan (name / nama)'); return }
      const get = (o: Record<string, unknown>, key: string | null) => (key ? o[key] : '')
      const parsed: CatRow[] = json
        .map((o) => {
          const pos = num(get(o, k.pos))
          const online = num(get(o, k.online))
          return {
            name: String(get(o, k.name) ?? '').trim(),
            category: String(get(o, k.cat) ?? '').trim(),
            sku: String(get(o, k.sku) ?? '').trim(),
            barcode: String(get(o, k.barcode) ?? '').trim(),
            cost: num(get(o, k.buy)),
            price: pos || online,
            priceOnline: online || pos,
            stock: Math.round(num(get(o, k.qty))),
            unit: String(get(o, k.uom) ?? '').trim() || 'pcs',
            description: String(get(o, k.desc) ?? '').trim(),
            image: String(get(o, k.photo) ?? '').trim(),
            active: truthy(get(o, k.pub)),
          } as CatRow
        })
        .filter((r) => r.name)
      if (!parsed.length) { toast.error('Tidak ada baris produk valid'); return }
      setRows(parsed)
      toast.success(`${parsed.length} baris terbaca dari sheet "${sheetName}"`)
    } catch (err) {
      console.warn(err)
      toast.error('Gagal membaca file. Pastikan .xlsx / .csv valid')
    }
  }

  const apply = async () => {
    if (aggRows.length === 0) return
    setBusy(true)
    try {
      const newRows: CatRow[] = []
      const existRows: { row: CatRow; product: (typeof products)[number] }[] = []
      for (const r of aggRows) {
        const ex = findExisting(r)
        if (ex) existRows.push({ row: r, product: ex })
        else newRows.push(r)
      }

      // Pastikan kategori ada (untuk produk baru + update kategori existing)
      const relevant = updateExisting ? aggRows : newRows
      const catMap = await ensureCategories(relevant.map((r) => r.category))
      const catId = (name: string) => catMap.get(name.trim().toLowerCase()) ?? ''

      const inv = useInventoryStore.getState()
      let failed = 0

      // 1. Buat produk baru
      let createdN = 0
      if (newRows.length) {
        const stamp = Date.now().toString(36)
        const usedSku = new Set(products.map((p) => p.sku.toLowerCase()))
        const inputs: BulkProductInput[] = newRows.map((r, i) => {
          let sku = r.sku
          if (!sku || usedSku.has(sku.toLowerCase())) sku = `IMP-${stamp}-${i}`
          usedSku.add(sku.toLowerCase())
          return {
            category_id: catId(r.category), name: r.name, sku, barcode: r.barcode, description: r.description,
            price: r.price, cost_price: r.cost, stock: Math.max(0, r.stock), min_stock: 0, unit: r.unit, is_active: r.active,
            image_url: r.image || undefined, price_online: r.priceOnline,
          }
        })
        const { products: created, failed: pf } = await bulkAdd(inputs)
        failed += pf
        // Seed stok awal ke outlet terpilih (urutan `created` = urutan input)
        failed += await inv.bulkUpsert(outletId, created.map((p, i) => ({ productId: p.id, stock: Math.max(0, newRows[i].stock) })))
        createdN = created.length - pf
      }

      // 2. Perbarui produk yang sudah ada (harga/modal/foto/kategori) — stok TIDAK disentuh
      let updatedN = 0
      if (updateExisting && existRows.length) {
        const patches: ProductPatch[] = existRows.map(({ row, product }) => ({
          id: product.id,
          price: row.price || undefined,
          cost_price: row.cost || undefined,
          price_online: row.priceOnline || undefined,
          image_url: row.image || undefined,
          category_id: row.category ? catId(row.category) || undefined : undefined,
        }))
        failed += await bulkPatch(patches)
        updatedN = existRows.length
      }

      useProductStore.getState().projectStock(activeOutletId)
      useVariantStore.getState().projectVariantStock(activeOutletId)
      const oname = outlets.find((o) => o.id === outletId)?.name ?? ''
      if (failed > 0) {
        toast.warning(`Import: ${createdN} produk baru${updatedN ? `, ${updatedN} diperbarui` : ''}, tapi ${failed} baris GAGAL ke server — muat ulang & ulangi yang gagal.`)
      } else {
        toast.success(`Import selesai: ${createdN} produk baru${updatedN ? `, ${updatedN} diperbarui` : ''}${createdN ? ` (stok awal di ${oname})` : ''}`)
      }
      reset()
      onOpenChange(false)
    } catch (e) {
      console.warn(e)
      toast.error('Gagal menerapkan import')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Boxes size={18} /> Import Katalog Produk</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
          {!rows ? (
            <button onClick={() => fileRef.current?.click()} className="w-full rounded-xl border-2 border-dashed py-10 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-muted/30 transition-colors">
              <Upload size={28} className="text-muted-foreground" />
              <p className="text-sm font-medium">Pilih file .xlsx / .csv</p>
              <p className="text-xs text-muted-foreground text-center max-w-sm">Mendukung format ekspor Olsera (kolom <span className="font-mono">name, category, buy_price, sell_price, stock_qty, sku, photo_1</span>). Kategori dibuat otomatis.</p>
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 truncate"><FileSpreadsheet size={15} className="text-emerald-600 shrink-0" /> {fileName}</span>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={reset}>Ganti</Button>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-lg bg-muted/40 p-2"><p className="text-lg font-bold">{aggRows.length}</p><p className="text-xs text-muted-foreground">Produk</p></div>
                <div className="rounded-lg bg-blue-50 p-2"><p className="text-lg font-bold text-blue-700">{newCount}</p><p className="text-xs text-muted-foreground">Baru</p></div>
                <div className="rounded-lg bg-amber-50 p-2"><p className="text-lg font-bold text-amber-700">{matchedCount}</p><p className="text-xs text-muted-foreground">Sudah ada</p></div>
                <div className="rounded-lg bg-violet-50 p-2"><p className="text-lg font-bold text-violet-700">{newCats}</p><p className="text-xs text-muted-foreground">Kategori baru</p></div>
              </div>

              <div className="space-y-2">
                <Label>Outlet untuk stok awal (produk baru)</Label>
                <Select value={outletId} onValueChange={(v) => v && setOutletId(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <div><p className="text-sm font-medium flex items-center gap-1.5"><Tag size={14} /> Perbarui produk yang sudah ada</p><p className="text-xs text-muted-foreground">{matchedCount} produk: harga, modal, foto & kategori ditimpa dari file (stok tidak diubah)</p></div>
                <Switch checked={updateExisting} onCheckedChange={setUpdateExisting} />
              </div>

              <div className="max-h-48 overflow-y-auto rounded-lg border text-xs">
                {aggRows.slice(0, 60).map((r, i) => {
                  const ex = findExisting(r)
                  return (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                      {r.image ? <ImageIcon size={13} className="text-muted-foreground shrink-0" /> : <span className="w-[13px] shrink-0" />}
                      <span className="truncate flex-1">{r.name}</span>
                      {r.category && <Badge variant="outline" className="text-[10px] shrink-0">{r.category}</Badge>}
                      <span className="tabular-nums text-muted-foreground shrink-0 w-20 text-right">{formatRupiah(r.price)}</span>
                      <span className="tabular-nums shrink-0 w-10 text-right">{r.stock}</span>
                      {ex ? <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 shrink-0">ada</Badge> : <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 shrink-0">baru</Badge>}
                    </div>
                  )
                })}
                {aggRows.length > 60 && <p className="text-center text-muted-foreground py-2">…dan {aggRows.length - 60} produk lagi</p>}
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Tutup</Button>
          <Button onClick={apply} disabled={!rows || busy || (newCount === 0 && (!updateExisting || matchedCount === 0))} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
            {busy ? <><Loader2 size={15} className="animate-spin" /> Memproses…</> : <><CheckCircle2 size={15} /> Import {newCount > 0 ? `${newCount} produk` : ''}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
