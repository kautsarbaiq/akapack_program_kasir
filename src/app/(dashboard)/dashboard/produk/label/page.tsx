'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer, Search, Tag, X, CheckSquare } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProductStore } from '@/stores/use-product-store'
import { useCategoryStore } from '@/stores/use-category-store'
import { rankedSearch } from '@/lib/utils'
import type { Product } from '@/types'
import { toast } from 'sonner'

/** Angka gaya label toko: 44550 → "44.550" (tanpa "Rp", titik ribuan). */
const labelPrice = (n: number) => new Intl.NumberFormat('id-ID').format(Math.round(n))

/**
 * Baris harga pada label — tiap satuan ditulis relatif terhadap satuan DI BAWAHNYA,
 * persis seperti label fisik toko: "1 PACK (25pcs)" lalu "1 CTN (20pack)".
 * (CTN faktornya 500 pcs; karena 1 pack = 25 pcs → 500/25 = 20 pack.)
 */
function priceRows(p: Product): { label: string; price: number }[] {
  const rows: { label: string; price: number }[] = []
  const units = [...(p.units ?? [])].filter((u) => u.factor > 0).sort((a, b) => a.factor - b.factor)
  // Satuan dasar selalu tampil lebih dulu (mis. "1 PCS")
  rows.push({ label: `1 ${p.unit.toUpperCase()}`, price: p.price })
  let prevFactor = 1
  let prevName = p.unit
  for (const u of units) {
    const isi = Math.round(u.factor / prevFactor)
    rows.push({ label: `1 ${u.name.toUpperCase()} (${isi}${prevName.toLowerCase()})`, price: u.price })
    prevFactor = u.factor
    prevName = u.name
  }
  return rows
}

export default function LabelHargaPage() {
  const products = useProductStore((s) => s.products)
  const categories = useCategoryStore((s) => s.categories)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('all')
  const [picked, setPicked] = useState<string[]>([])

  const list = useMemo(() => {
    const base = products.filter((p) => p.is_active && (cat === 'all' || p.category_id === cat))
    return rankedSearch(base, search, (p) => [p.name, p.sku, p.barcode], (p) => p.name).slice(0, 60)
  }, [products, search, cat])

  const selected = useMemo(
    () => picked.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[],
    [picked, products]
  )

  const toggle = (id: string) => setPicked((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const addAllShown = () => {
    setPicked((s) => Array.from(new Set([...s, ...list.map((p) => p.id)])))
    toast.success(`${list.length} produk ditambahkan ke daftar cetak`)
  }
  const handlePrint = () => {
    if (!selected.length) { toast.error('Pilih minimal 1 produk'); return }
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Panel pemilih — tidak ikut tercetak */}
      <div className="print:hidden space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/produk" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"><ArrowLeft size={13} /> Produk</Link>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Tag size={22} /> Cetak Label Harga</h1>
            <p className="text-muted-foreground text-sm mt-1">Pilih produk, lalu cetak label rak — harga per satuan otomatis dari data produk.</p>
          </div>
          <Button onClick={handlePrint} disabled={!selected.length} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
            <Printer size={16} /> Cetak {selected.length > 0 && `(${selected.length})`}
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Cari nama, SKU, barcode…" className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="all">Semua Kategori</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={addAllShown}><CheckSquare size={14} /> Pilih semua yang tampil</Button>
          {selected.length > 0 && <Button variant="ghost" size="sm" className="text-xs" onClick={() => setPicked([])}>Kosongkan</Button>}
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="max-h-[40vh] overflow-y-auto divide-y">
              {list.map((p) => {
                const on = picked.includes(p.id)
                return (
                  <button key={p.id} onClick={() => toggle(p.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors ${on ? 'bg-primary/5' : ''}`}>
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-primary border-primary' : 'border-input'}`}>
                      {on && <span className="text-[10px] font-bold text-primary-foreground">✓</span>}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{p.sku}{p.barcode ? ` · ${p.barcode}` : ''}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{(p.units?.length ?? 0) + 1} satuan</span>
                  </button>
                )
              })}
              {list.length === 0 && <p className="py-10 text-center text-muted-foreground text-sm">Tidak ada produk</p>}
            </div>
          </CardContent>
        </Card>

        {selected.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Akan dicetak:</span>
            {selected.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1 text-xs bg-muted rounded-full pl-2.5 pr-1 py-1">
                {p.name.slice(0, 28)}{p.name.length > 28 ? '…' : ''}
                <button onClick={() => toggle(p.id)} className="hover:text-destructive"><X size={12} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── AREA CETAK: label kuning. id="print-area" = pola cetak baku app (lihat globals.css):
          saat print, HANYA blok ini yang terlihat — sidebar/header/panel pemilih otomatis hilang. ── */}
      {selected.length > 0 && (
        <div id="print-area" className="grid grid-cols-2 gap-3">
          {selected.map((p) => {
            const rows = priceRows(p)
            return (
              <div key={p.id} style={{ background: '#FFD100', color: '#111', padding: '14px 16px', breakInside: 'avoid', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                <p style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.15, textTransform: 'uppercase' }}>{p.name}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11, fontWeight: 700, marginTop: 4, letterSpacing: 0.3 }}>
                  <span>{p.sku}</span>
                  <span>{p.barcode || '-'}</span>
                </div>
                <div style={{ borderTop: '2px solid #111', marginTop: 8, paddingTop: 6 }}>
                  {rows.map((r, i) => (
                    <div key={r.label} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10,
                      paddingTop: i === 0 ? 0 : 5, marginTop: i === 0 ? 0 : 5,
                      borderTop: i === 0 ? 'none' : '1.5px solid rgba(0,0,0,.35)',
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{r.label}</span>
                      <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1 }}>{labelPrice(r.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
