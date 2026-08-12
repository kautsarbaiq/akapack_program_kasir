'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer, Search, Tag, X, CheckSquare, Save } from 'lucide-react'
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

/** Isian manual PACK & CTN per produk (diketik langsung di halaman ini). */
type Manual = { packIsi: number; packHarga: number; ctnIsi: number; ctnHarga: number }

/** Ambil nilai awal dari data produk bila satuannya sudah pernah diisi. */
function initialManual(p: Product): Manual {
  const units = [...(p.units ?? [])].filter((u) => u.factor > 0).sort((a, b) => a.factor - b.factor)
  const pack = units.find((u) => u.name.toUpperCase() === 'PACK')
  const ctn = units.find((u) => u.name.toUpperCase() === 'CTN')
  // Satuan dasar sudah berupa PACK → harga pack = harga jual produk, dan isi CTN dihitung
  // langsung dari faktornya. Kalau dasarnya pcs, isi CTN = faktor CTN ÷ faktor PACK.
  const baseIsPack = !isPieceUnit(p.unit)
  return {
    packIsi: pack?.factor ?? 0,
    packHarga: pack?.price ?? (baseIsPack ? p.price : 0),
    ctnIsi: ctn ? Math.round(ctn.factor / (pack?.factor || 1)) : 0,
    ctnHarga: ctn?.price ?? 0,
  }
}

/** Satuan yang berarti "satuan terkecil" — kalau satuan dasar produk bukan ini, berarti dasarnya
 *  sudah berupa kemasan (mis. produk yang dijual per PACK). */
const PIECE_UNITS = ['pcs', 'buah', 'unit', 'biji', 'lembar', 'batang']
const isPieceUnit = (u: string) => PIECE_UNITS.includes(u.trim().toLowerCase())

/**
 * Baris harga pada label: PACK lalu CTN — persis seperti label fisik (tanpa baris satuan dasar
 * terpisah, karena itulah yang dulu bikin harga tampil DUA KALI saat Harga PACK diisi).
 * "PACK isi (pcs)" tampil sebagai keterangan isi: "1 PACK (50pcs)".
 * Harga PACK boleh dikosongkan → otomatis pakai harga jual produk.
 */
function priceRows(p: Product, m: Manual): { label: string; price: number }[] {
  const rows: { label: string; price: number }[] = []
  if (m.packIsi > 0 || m.packHarga > 0) {
    rows.push({
      label: m.packIsi > 0 ? `1 PACK (${m.packIsi}pcs)` : '1 PACK',
      price: m.packHarga > 0 ? m.packHarga : p.price,
    })
  }
  if (m.ctnIsi > 0 || m.ctnHarga > 0) {
    rows.push({
      label: m.ctnIsi > 0 ? `1 CTN (${m.ctnIsi}pack)` : '1 CTN',
      price: m.ctnHarga,
    })
  }
  // Produk tanpa PACK/CTN → label harga biasa (satuan dasarnya saja).
  if (rows.length === 0) rows.push({ label: `1 ${p.unit.toUpperCase()}`, price: p.price })
  return rows
}

export default function LabelHargaPage() {
  const products = useProductStore((s) => s.products)
  const categories = useCategoryStore((s) => s.categories)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('all')
  const [picked, setPicked] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const bulkPatch = useProductStore((s) => s.bulkPatch)

  const list = useMemo(() => {
    const base = products.filter((p) => p.is_active && (cat === 'all' || p.category_id === cat))
    return rankedSearch(base, search, (p) => [p.name, p.sku, p.barcode], (p) => p.name).slice(0, 60)
  }, [products, search, cat])

  const selected = useMemo(
    () => picked.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[],
    [picked, products]
  )

  // Isian manual PACK/CTN per produk — diisi otomatis dari data produk (kalau ada), bisa diketik ulang.
  const [manual, setManual] = useState<Record<string, Manual>>({})
  const manualOf = (p: Product): Manual => manual[p.id] ?? initialManual(p)
  const setManualField = (id: string, field: keyof Manual, val: number) =>
    setManual((s) => ({ ...s, [id]: { ...(s[id] ?? initialManual(products.find((p) => p.id === id)!)), [field]: val } }))

  const toggle = (id: string) => setPicked((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const addAllShown = () => {
    setPicked((s) => Array.from(new Set([...s, ...list.map((p) => p.id)])))
    toast.success(`${list.length} produk ditambahkan ke daftar cetak`)
  }
  const handlePrint = () => {
    if (!selected.length) { toast.error('Pilih minimal 1 produk'); return }
    window.print()
  }

  /**
   * Simpan isian PACK/CTN ke data produk supaya tak perlu diketik ulang tiap cetak —
   * sekaligus membuat satuan besar bisa dipilih saat jualan di kasir.
   * FAKTOR dihitung otomatis dalam satuan DASAR: PACK = isi pack; CTN = isi pack × isi ctn.
   * Pakai bulkPatch (hanya menyentuh kolom units) — TIDAK mengubah stok.
   */
  const saveToProducts = async () => {
    const patches = selected.map((p) => {
      const m = manualOf(p)
      const units: { name: string; factor: number; price: number }[] = []
      // FAKTOR selalu dalam SATUAN DASAR produk — salah hitung di sini bikin stok di kasir kacau.
      if (isPieceUnit(p.unit)) {
        // Dasar = pcs → PACK & CTN dua-duanya satuan besar yang bisa dijual.
        if (m.packIsi > 0 && m.packHarga > 0) units.push({ name: 'PACK', factor: m.packIsi, price: m.packHarga })
        if (m.ctnIsi > 0 && m.ctnHarga > 0) units.push({ name: 'CTN', factor: (m.packIsi || 1) * m.ctnIsi, price: m.ctnHarga })
      } else {
        // Dasar SUDAH pack → "isi pcs" cuma keterangan label (bukan konversi jual),
        // jadi hanya CTN yang disimpan: 1 CTN = ctnIsi pack.
        if (m.ctnIsi > 0 && m.ctnHarga > 0) units.push({ name: 'CTN', factor: m.ctnIsi, price: m.ctnHarga })
      }
      return { id: p.id, units }
    }).filter((x) => x.units.length > 0)
    if (!patches.length) { toast.error('Belum ada PACK/CTN yang diisi'); return }
    setSaving(true)
    const failed = await bulkPatch(patches)
    setSaving(false)
    if (failed > 0) toast.error(`${failed} produk GAGAL tersimpan — cek koneksi lalu ulangi`)
    else toast.success(`Satuan ${patches.length} produk tersimpan`)
  }

  return (
    <div className="space-y-6">
      {/* Panel pemilih — tidak ikut tercetak */}
      <div className="print:hidden space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/produk" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"><ArrowLeft size={13} /> Produk</Link>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Tag size={22} /> Cetak Label Harga</h1>
            <p className="text-muted-foreground text-sm mt-1">Pilih produk, isi PACK &amp; CTN-nya, lalu cetak label rak.</p>
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
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-2.5 border-b">
                <p className="text-sm font-semibold">Isi PACK & CTN ({selected.length} produk)</p>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={saveToProducts} disabled={saving}>
                  <Save size={13} /> {saving ? 'Menyimpan…' : 'Simpan ke produk'}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Produk', `PACK isi (${'pcs'})`, 'Harga PACK', 'CTN isi (pack)', 'Harga CTN', ''].map((h) => (
                        <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selected.map((p) => {
                      const m = manualOf(p)
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="py-2 px-3">
                            <p className="text-xs font-medium truncate max-w-[220px]">{p.name}</p>
                            <p className="text-[11px] text-muted-foreground font-mono">{p.sku}</p>
                          </td>
                          <td className="py-2 px-3"><Input type="number" min={0} className="h-8 w-24 text-right" value={m.packIsi || ''} onChange={(e) => setManualField(p.id, 'packIsi', Number(e.target.value) || 0)} /></td>
                          <td className="py-2 px-3"><Input type="number" min={0} className="h-8 w-28 text-right" value={m.packHarga || ''} onChange={(e) => setManualField(p.id, 'packHarga', Number(e.target.value) || 0)} /></td>
                          <td className="py-2 px-3"><Input type="number" min={0} className="h-8 w-24 text-right" value={m.ctnIsi || ''} onChange={(e) => setManualField(p.id, 'ctnIsi', Number(e.target.value) || 0)} /></td>
                          <td className="py-2 px-3"><Input type="number" min={0} className="h-8 w-28 text-right" value={m.ctnHarga || ''} onChange={(e) => setManualField(p.id, 'ctnHarga', Number(e.target.value) || 0)} /></td>
                          <td className="py-2 px-3"><button onClick={() => toggle(p.id)} className="text-muted-foreground hover:text-destructive"><X size={14} /></button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="px-4 py-2.5 text-xs text-muted-foreground border-t">
                <b>PACK isi</b> tampil sebagai keterangan di label (mis. &quot;1 PACK (50pcs)&quot;).
                <b> Harga PACK</b> boleh dikosongkan — otomatis memakai harga jual produk.
                Kosongkan CTN kalau produk tak punya karton. <b>Simpan ke produk</b> menyimpan satuan besar
                supaya bisa dipilih saat jualan di kasir.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── AREA CETAK: label kuning. id="print-area" = pola cetak baku app (lihat globals.css):
          saat print, HANYA blok ini yang terlihat — sidebar/header/panel pemilih otomatis hilang. ── */}
      {selected.length > 0 && (
        <div id="print-area" className="grid grid-cols-2 gap-3">
          {selected.map((p) => {
            const rows = priceRows(p, manualOf(p))
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
