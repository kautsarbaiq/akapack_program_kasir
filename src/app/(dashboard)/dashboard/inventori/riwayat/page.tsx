'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, History, Download, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, ClipboardCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OutletFilter } from '@/components/dashboard/outlet-filter'
import { useStockMovementStore } from '@/stores/use-stock-movement-store'
import { useTransactionStore } from '@/stores/use-transaction-store'
import { useProductStore } from '@/stores/use-product-store'
import { useOutletStore } from '@/stores/use-outlet-store'
import { useInventoryStore } from '@/stores/use-inventory-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useRole, useCurrentUserStore } from '@/stores/use-current-user-store'
import { formatNumber, formatDate, rankedSearch, localDay } from '@/lib/utils'
import type { Product } from '@/types'
import { toast } from 'sonner'

/** Nomor rujukan yang tampil di kolom "No. Report / No. Transaksi". */
type Row = {
  date: string; time: string; type: string
  qty: number; ref: string; outlet: string; after: number
}

const TYPE_LABEL: Record<string, string> = {
  in: 'Masuk', out: 'Keluar', transfer: 'Transfer', opname: 'Opname', adjustment: 'Penyesuaian',
}

export default function RiwayatItemPage() {
  const movements = useStockMovementStore((s) => s.movements)
  const transactions = useTransactionStore((s) => s.transactions)
  const products = useProductStore((s) => s.products)
  const outlets = useOutletStore((s) => s.outlets)
  const activeOutletId = useActiveOutletStore((s) => s.activeOutletId)
  const { isCashier } = useRole()
  const me = useCurrentUserStore((s) => s.user)

  // Riwayat lengkap butuh SEMUA pergerakan + transaksi (bukan hanya jendela awal).
  useEffect(() => {
    useStockMovementStore.getState().ensure()
    useTransactionStore.getState().ensureAll()
  }, [])

  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Product | null>(null)
  // Kasir dikunci ke cabangnya (fail-closed); lainnya bebas pilih.
  const lockedOutlet = isCashier ? (me?.outletId ?? '__none__') : null
  const [outletFilter, setOutletFilter] = useState('all')
  const effectiveOutlet = lockedOutlet ?? outletFilter

  const list = useMemo(() => {
    if (!search.trim()) return []
    return rankedSearch(products, search, (p) => [p.name, p.sku, p.barcode], (p) => p.name).slice(0, 12)
  }, [products, search])

  // Nomor nota per id transaksi → kolom "No. Transaksi" pada barang keluar.
  const trxNoById = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of transactions) m.set(t.id, t.transaction_number)
    return m
  }, [transactions])

  const rows = useMemo<Row[]>(() => {
    if (!picked) return []
    return movements
      .filter((mv) => mv.product_id === picked.id && (effectiveOutlet === 'all' || mv.outlet_id === effectiveOutlet))
      .map((mv) => {
        // Nomor rujukan: nota penjualan (dari reference_id) → kalau tidak ada, pakai catatan
        // (mis. "Stok Masuk IN26080600000059" / "Transfer ke Toko Kemasan Garut").
        const trxNo = mv.reference_id ? trxNoById.get(mv.reference_id) : undefined
        return {
          date: localDay(mv.created_at),
          time: new Date(mv.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          type: mv.type,
          qty: mv.quantity,
          ref: trxNo || mv.notes || '—',
          outlet: outlets.find((o) => o.id === mv.outlet_id)?.name ?? '—',
          after: mv.after_stock,
        }
      })
      .sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)))
  }, [picked, movements, effectiveOutlet, outlets, trxNoById])

  const masuk = rows.filter((r) => r.type === 'in')
  const keluar = rows.filter((r) => r.type === 'out')
  const transfer = rows.filter((r) => r.type === 'transfer')
  const lainnya = rows.filter((r) => r.type === 'opname' || r.type === 'adjustment')
  const sum = (rs: Row[]) => rs.reduce((s, r) => s + Math.abs(r.qty), 0)

  const stokKini = picked
    ? (effectiveOutlet === 'all'
        ? outlets.reduce((s, o) => s + (useInventoryStore.getState().stockAt(o.id, picked.id) ?? 0), 0)
        : (useInventoryStore.getState().stockAt(effectiveOutlet, picked.id) ?? 0))
    : 0

  const exportXlsx = async () => {
    if (!picked || !rows.length) return
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const sheet = (rs: Row[]) => XLSX.utils.json_to_sheet(rs.map((r) => ({
      Tanggal: r.date, Jam: r.time, Jenis: TYPE_LABEL[r.type] ?? r.type,
      Qty: r.qty, 'No. Report / Transaksi': r.ref, Cabang: r.outlet, 'Sisa Stok': r.after,
    })))
    XLSX.utils.book_append_sheet(wb, sheet(rows), 'Semua')
    if (masuk.length) XLSX.utils.book_append_sheet(wb, sheet(masuk), 'Masuk Barang')
    if (keluar.length) XLSX.utils.book_append_sheet(wb, sheet(keluar), 'Barang Keluar')
    if (transfer.length) XLSX.utils.book_append_sheet(wb, sheet(transfer), 'Barang Transfer')
    XLSX.writeFile(wb, `history-${picked.sku}-${localDay(new Date())}.xlsx`)
    toast.success('Riwayat diunduh')
  }

  const Table = ({ rs, refLabel }: { rs: Row[]; refLabel: string }) => (
    <div className="max-h-[60vh] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-background z-10">
          <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
            {['Tanggal', 'Jam', 'Jumlah / Qty', refLabel, 'Cabang', 'Sisa Stok'].map((h) => (
              <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground bg-muted/50 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rs.map((r, i) => (
            <tr key={r.ref + i} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-muted/30">
              <td className="py-2.5 px-3 whitespace-nowrap">{formatDate(r.date)}</td>
              <td className="py-2.5 px-3 text-muted-foreground text-xs">{r.time}</td>
              <td className={`py-2.5 px-3 font-semibold ${r.qty >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {r.qty >= 0 ? '+' : ''}{formatNumber(r.qty)}
              </td>
              <td className="py-2.5 px-3 text-xs font-mono">{r.ref}</td>
              <td className="py-2.5 px-3 text-xs">{r.outlet}</td>
              <td className="py-2.5 px-3 text-muted-foreground">{formatNumber(r.after)}</td>
            </tr>
          ))}
          {rs.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Belum ada data</td></tr>}
        </tbody>
      </table>
    </div>
  )

  const Stat = ({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ size?: number }>; label: string; value: string; color: string }) => (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Icon size={14} /> {label}</div>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
    </CardContent></Card>
  )

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/inventori" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"><ArrowLeft size={13} /> Inventori</Link>
        <h1 className="text-2xl font-bold flex items-center gap-2"><History size={22} /> History Item Produk</h1>
        <p className="text-muted-foreground text-sm mt-1">Riwayat lengkap satu barang: masuk, keluar, dan transfer — beserta tanggal, jumlah, dan nomor rujukannya.</p>
      </div>

      {/* Pilih produk */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Cari barang… (mis. botol leon)" className="pl-9 h-9"
                value={search} onChange={(e) => { setSearch(e.target.value); setPicked(null) }} />
            </div>
            {!lockedOutlet && <OutletFilter value={outletFilter} onChange={setOutletFilter} />}
          </div>

          {list.length > 0 && !picked && (
            <div className="divide-y border rounded-md max-h-64 overflow-y-auto">
              {list.map((p) => (
                <button key={p.id} onClick={() => { setPicked(p); setSearch(p.name) }}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {picked && (
        <>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-bold">{picked.name}</h2>
              <p className="text-xs text-muted-foreground font-mono">{picked.sku}{picked.barcode ? ` · ${picked.barcode}` : ''}</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportXlsx} disabled={!rows.length}>
              <Download size={14} /> Excel
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={ArrowDownToLine} label="Total Masuk" value={`+${formatNumber(sum(masuk))}`} color="oklch(0.6 0.17 155)" />
            <Stat icon={ArrowUpFromLine} label="Total Keluar" value={`-${formatNumber(sum(keluar))}`} color="oklch(0.6 0.2 25)" />
            <Stat icon={ArrowLeftRight} label="Transfer" value={formatNumber(sum(transfer))} color="oklch(0.6 0.15 250)" />
            <Stat icon={ClipboardCheck} label="Stok Sekarang" value={formatNumber(stokKini)} color="var(--foreground)" />
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Riwayat Pergerakan · {rows.length} baris</CardTitle></CardHeader>
            <CardContent>
              <Tabs defaultValue="semua">
                <TabsList>
                  <TabsTrigger value="semua">Semua ({rows.length})</TabsTrigger>
                  <TabsTrigger value="masuk">Masuk Barang ({masuk.length})</TabsTrigger>
                  <TabsTrigger value="keluar">Barang Keluar ({keluar.length})</TabsTrigger>
                  <TabsTrigger value="transfer">Transfer ({transfer.length})</TabsTrigger>
                  {lainnya.length > 0 && <TabsTrigger value="lain">Opname ({lainnya.length})</TabsTrigger>}
                </TabsList>
                <TabsContent value="semua" className="mt-4"><Table rs={rows} refLabel="No. Report / Transaksi" /></TabsContent>
                <TabsContent value="masuk" className="mt-4"><Table rs={masuk} refLabel="No. Report" /></TabsContent>
                <TabsContent value="keluar" className="mt-4"><Table rs={keluar} refLabel="No. Transaksi" /></TabsContent>
                <TabsContent value="transfer" className="mt-4"><Table rs={transfer} refLabel="Keterangan" /></TabsContent>
                {lainnya.length > 0 && <TabsContent value="lain" className="mt-4"><Table rs={lainnya} refLabel="Keterangan" /></TabsContent>}
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}

      {!picked && <p className="text-center text-muted-foreground text-sm py-10">Cari lalu pilih barang untuk melihat riwayatnya.</p>}
    </div>
  )
}
