'use client'

import { useState, useRef, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useProductStore } from '@/stores/use-product-store'
import { useInventoryStore } from '@/stores/use-inventory-store'
import { useCategoryStore } from '@/stores/use-category-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useVariantStore } from '@/stores/use-variant-store'
import { useOutletStore } from '@/stores/use-outlet-store'
import type { ProductFormValues } from '@/lib/validations'
import { toast } from 'sonner'

type Row = { name: string; price: number; qty: number }
type Mode = 'add' | 'sub' | 'set'

const NAME_KEYS = ['name', 'nama', 'produk', 'product', 'nama produk']
const PRICE_KEYS = ['price', 'harga', 'harga jual']
const QTY_KEYS = ['stock_qty', 'stock', 'stok', 'qty', 'jumlah', 'quantity']

function pickKey(obj: Record<string, unknown>, names: string[]) {
  for (const k of Object.keys(obj)) if (names.includes(k.toLowerCase().trim())) return k
  return null
}

export function ImportStokDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const products = useProductStore((s) => s.products)
  const bulkAdd = useProductStore((s) => s.bulkAdd)
  const categories = useCategoryStore((s) => s.categories)
  const activeOutletId = useActiveOutletStore((s) => s.activeOutletId)
  const outlets = useOutletStore((s) => s.outlets)

  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [mode, setMode] = useState<Mode>('add')
  const [createNew, setCreateNew] = useState(true)
  const [outletId, setOutletId] = useState(activeOutletId)
  const [busy, setBusy] = useState(false)

  const byName = (n: string) => products.find((p) => p.name.trim().toLowerCase() === n.trim().toLowerCase())
  // Agregasi baris ber-nama sama (set: terakhir menang; add/sub: dijumlah) — dipakai preview DAN apply
  const aggRows = useMemo(() => {
    if (!rows) return [] as Row[]
    const m = new Map<string, Row>()
    for (const r of rows) {
      const k = r.name.trim().toLowerCase()
      const ex = m.get(k)
      if (ex) { ex.qty = mode === 'set' ? r.qty : ex.qty + r.qty; ex.price = r.price || ex.price }
      else m.set(k, { ...r })
    }
    return [...m.values()]
  }, [rows, mode])
  const matchedCount = aggRows.filter((r) => byName(r.name)).length
  const newCount = aggRows.length - matchedCount

  const reset = () => { setRows(null); setFileName(''); if (fileRef.current) fileRef.current.value = '' }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      if (!json.length) { toast.error('File kosong'); return }
      const nk = pickKey(json[0], NAME_KEYS)
      const pk = pickKey(json[0], PRICE_KEYS)
      const qk = pickKey(json[0], QTY_KEYS)
      if (!nk || !qk) { toast.error('Kolom tidak dikenali. Wajib ada: name & stock_qty (opsional Price)'); return }
      const parsed: Row[] = json
        .map((o) => ({ name: String(o[nk] ?? '').trim(), price: Math.max(0, Number(o[pk ?? ''] ?? 0) || 0), qty: Math.max(0, Math.round(Number(o[qk] ?? 0) || 0)) }))
        .filter((r) => r.name)
      if (!parsed.length) { toast.error('Tidak ada baris valid'); return }
      setRows(parsed)
      toast.success(`${parsed.length} baris terbaca`)
    } catch (err) {
      console.warn(err)
      toast.error('Gagal membaca file. Pastikan .xlsx / .csv valid')
    }
  }

  const apply = async () => {
    if (aggRows.length === 0) return
    setBusy(true)
    try {
      const inv = useInventoryStore.getState()
      const matchedEntries: { productId: string; stock: number }[] = []
      const newRows: Row[] = []
      for (const r of aggRows) {
        const p = byName(r.name)
        if (p) {
          const cur = inv.stockAt(outletId, p.id, undefined) ?? p.stock
          const final = mode === 'set' ? r.qty : mode === 'add' ? cur + r.qty : Math.max(0, cur - r.qty)
          matchedEntries.push({ productId: p.id, stock: final })
        } else newRows.push(r)
      }
      let failed = 0
      if (matchedEntries.length) failed += await inv.bulkUpsert(outletId, matchedEntries)

      let createdN = 0
      if (createNew && newRows.length && !categories[0]?.id) {
        toast.warning(`${newRows.length} produk baru dilewati — buat minimal 1 kategori dulu di menu Kategori.`)
      } else if (createNew && newRows.length) {
        const defaultCat = categories[0]!.id
        const stamp = Date.now().toString(36) // SKU unik per-baris (stamp + index) — cegah tabrakan
        const values: ProductFormValues[] = newRows.map((r, i) => ({
          category_id: defaultCat, name: r.name, sku: `IMP-${stamp}-${i}`, barcode: '', description: '',
          price: r.price, cost_price: r.price, stock: Math.max(0, r.qty), min_stock: 0, unit: 'pcs', is_active: true,
        }))
        const { products: created, failed: pf } = await bulkAdd(values)
        failed += pf
        failed += await inv.bulkUpsert(outletId, created.map((p, i) => ({ productId: p.id, stock: Math.max(0, newRows[i].qty) })))
        createdN = created.length - pf
      }

      useProductStore.getState().projectStock(activeOutletId)
      useVariantStore.getState().projectVariantStock(activeOutletId)
      const oname = outlets.find((o) => o.id === outletId)?.name ?? ''
      if (failed > 0) {
        toast.warning(`Import: ${matchedEntries.length} diperbarui${createdN ? `, ${createdN} baru` : ''}, tapi ${failed} baris GAGAL ke server — muat ulang halaman untuk cek & ulangi.`)
      } else {
        toast.success(`Import selesai: ${matchedEntries.length} produk diperbarui${createdN ? `, ${createdN} produk baru` : ''} di ${oname}`)
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileSpreadsheet size={18} /> Import Stok dari Excel</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
          {!rows ? (
            <button onClick={() => fileRef.current?.click()} className="w-full rounded-xl border-2 border-dashed py-10 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-muted/30 transition-colors">
              <Upload size={28} className="text-muted-foreground" />
              <p className="text-sm font-medium">Pilih file .xlsx / .csv</p>
              <p className="text-xs text-muted-foreground">Kolom: <span className="font-mono">name</span>, <span className="font-mono">Price</span>, <span className="font-mono">stock_qty</span></p>
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 truncate"><FileSpreadsheet size={15} className="text-emerald-600 shrink-0" /> {fileName}</span>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={reset}>Ganti</Button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/40 p-2"><p className="text-lg font-bold">{rows.length}</p><p className="text-xs text-muted-foreground">Baris</p></div>
                <div className="rounded-lg bg-emerald-50 p-2"><p className="text-lg font-bold text-emerald-700">{matchedCount}</p><p className="text-xs text-muted-foreground">Cocok</p></div>
                <div className="rounded-lg bg-blue-50 p-2"><p className="text-lg font-bold text-blue-700">{newCount}</p><p className="text-xs text-muted-foreground">Baru</p></div>
              </div>

              <div className="space-y-2">
                <Label>Mode (untuk produk yang cocok)</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Tambah stok (+ qty)</SelectItem>
                    <SelectItem value="sub">Kurangi stok (− qty)</SelectItem>
                    <SelectItem value="set">Set stok = qty (opname)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Outlet</Label>
                <Select value={outletId} onValueChange={(v) => v && setOutletId(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <div><p className="text-sm font-medium flex items-center gap-1.5"><Plus size={14} /> Buat produk baru</p><p className="text-xs text-muted-foreground">{newCount} produk yang belum ada akan dibuat (harga modal = harga jual, sesuaikan nanti)</p></div>
                <Switch checked={createNew} onCheckedChange={setCreateNew} />
              </div>

              <div className="max-h-40 overflow-y-auto rounded-lg border text-xs">
                {aggRows.slice(0, 80).map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                    <span className="truncate pr-2">{r.name}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="tabular-nums">{r.qty}</span>
                      {byName(r.name) ? <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">cocok</Badge> : <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">baru</Badge>}
                    </span>
                  </div>
                ))}
                {aggRows.length > 80 && <p className="text-center text-muted-foreground py-2">…dan {aggRows.length - 80} baris lagi</p>}
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Tutup</Button>
          <Button onClick={apply} disabled={!rows || busy || (matchedCount === 0 && (!createNew || newCount === 0))} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
            {busy ? <><Loader2 size={15} className="animate-spin" /> Memproses…</> : <><CheckCircle2 size={15} /> Terapkan</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
