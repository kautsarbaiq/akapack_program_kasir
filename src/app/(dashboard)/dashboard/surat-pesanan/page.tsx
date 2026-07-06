'use client'

import { useState, useMemo } from 'react'
import { FileText, Plus, Eye, X, Trash2, Printer, CheckCircle2, Send, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ProductCombobox } from '@/components/dashboard/product-combobox'
import { SalesOrderDocument, SALES_ORDER_STATUS } from '@/components/dashboard/salesorder-document'
import { useSalesOrderStore } from '@/stores/use-salesorder-store'
import { useProductStore } from '@/stores/use-product-store'
import { useOutletStore } from '@/stores/use-outlet-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useEmployeeStore } from '@/stores/use-employee-store'
import { useRole, useCurrentUserStore } from '@/stores/use-current-user-store'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { formatRupiah, formatDate, generateId, localDay } from '@/lib/utils'
import type { SalesOrder, SalesOrderItem, SalesOrderStatus } from '@/types'
import { toast } from 'sonner'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isPending = (d: SalesOrder) => isSupabaseConfigured() && !UUID_RE.test(d.id)

const STATUS_BADGE: Record<SalesOrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
  done: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-400 border-gray-200',
}

// Nomor SP harian dari MAX yang ada (bukan acak) → tak bentrok. Pakai tanggal lokal.
function genNo(existing: { number: string }[]) {
  const ymd = localDay(new Date()).replace(/-/g, '')
  const prefix = `SP-${ymd}-`
  const max = existing.reduce((mx, d) => {
    if (!d.number?.startsWith(prefix)) return mx
    const n = parseInt(d.number.slice(prefix.length), 10)
    return Number.isNaN(n) ? mx : Math.max(mx, n)
  }, 0)
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

type DraftItem = { product_id: string; qty: number }

export default function SuratPesananPage() {
  const salesOrders = useSalesOrderStore((s) => s.salesOrders)
  const addSalesOrder = useSalesOrderStore((s) => s.addSalesOrder)
  const setStatus = useSalesOrderStore((s) => s.setStatus)
  const deleteSalesOrder = useSalesOrderStore((s) => s.deleteSalesOrder)
  const products = useProductStore((s) => s.products)
  const outlets = useOutletStore((s) => s.outlets)
  const employees = useEmployeeStore((s) => s.employees)
  const activeOutletId = useActiveOutletStore((s) => s.activeOutletId)
  const { isOwner, isManager, isCashier } = useRole()
  const me = useCurrentUserStore((s) => s.user)

  // Kasir = lihat saja (tak bisa buat/ubah). Owner/manager/sales = boleh kelola.
  const canManage = !isCashier
  // Kasir & sales dikunci ke cabangnya; owner/manager lihat semua.
  // Kasir/sales TANPA cabang = fail-closed ('__none__' → tak lihat apa pun), bukan lihat semua.
  const lockedOutlet = (!isOwner && !isManager) ? (me?.outletId ?? '__none__') : null

  const [filter, setFilter] = useState<'all' | SalesOrderStatus>('all')
  // Simpan {id, nomor} baris yang diklik — diresolve ke dok LIVE di CABANG SENDIRI (branchOrders),
  // utamakan id (nomor duplikat legacy tak boleh membuka dokumen cabang lain); fallback nomor
  // menjaga dialog tetap hidup saat id sementara ditukar UUID setelah tersimpan.
  const [detailSel, setDetailSel] = useState<{ id: string; number: string } | null>(null)
  const [open, setOpen] = useState(false)

  // form
  const [outletId, setOutletId] = useState(activeOutletId)
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [sourcePhone, setSourcePhone] = useState('') // No. HP asal pesanan (nomor yang chat)
  const [salesId, setSalesId] = useState(me?.employeeId ?? '')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [bankName, setBankName] = useState('')
  const [bankRef, setBankRef] = useState('')
  const [shippingCost, setShippingCost] = useState(0)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([{ product_id: '', qty: 1 }])

  const branchOrders = useMemo(
    () => (lockedOutlet ? salesOrders.filter((d) => d.outlet_id === lockedOutlet) : salesOrders),
    [salesOrders, lockedOutlet]
  )
  const filtered = useMemo(
    () => (filter === 'all' ? branchOrders : branchOrders.filter((d) => d.status === filter)),
    [branchOrders, filter]
  )
  // Resolve HANYA di cabang sendiri; utamakan id, fallback nomor (untuk swap id sementara→UUID).
  const detail = detailSel
    ? branchOrders.find((d) => d.id === detailSel.id) ?? branchOrders.find((d) => d.number === detailSel.number) ?? null
    : null

  // Deteksi pesanan DOBEL: barang + jumlah persis sama (regardless nama/no HP pelanggan —
  // kasus "1 customer chat dari 2 nomor, pesanan sama"). Ditandai di daftar & diperingatkan saat buat.
  const itemsSig = (its: SalesOrder['items']) => its.map((i) => `${i.product_id}:${i.qty}`).sort().join('|')
  const dupById = useMemo(() => {
    const count = new Map<string, number>()
    const sigOf = new Map<string, string>()
    for (const d of branchOrders) {
      if (d.status === 'cancelled' || !d.items.length) continue
      const s = itemsSig(d.items)
      sigOf.set(d.id, s)
      count.set(s, (count.get(s) ?? 0) + 1)
    }
    const dup = new Set<string>()
    sigOf.forEach((s, id) => { if ((count.get(s) ?? 0) > 1) dup.add(id) })
    return dup
  }, [branchOrders])
  const isDup = (d: SalesOrder) => dupById.has(d.id)

  const doneCount = branchOrders.filter((d) => d.status === 'done').length
  const totalValue = branchOrders.filter((d) => d.status !== 'cancelled').reduce((s, d) => s + d.total, 0)
  const activeEmployees = employees.filter((e) => e.is_active)

  const priceOf = (pid: string) => products.find((p) => p.id === pid)?.price ?? 0
  const itemsSubtotal = items.reduce((s, i) => s + (i.qty || 0) * priceOf(i.product_id), 0)
  const formTotal = itemsSubtotal + (Number(shippingCost) || 0)

  const setItem = (idx: number, patch: Partial<DraftItem>) => setItems((ls) => ls.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  const addItem = () => setItems((ls) => [...ls, { product_id: '', qty: 1 }])
  const removeItem = (idx: number) => setItems((ls) => (ls.length <= 1 ? ls : ls.filter((_, i) => i !== idx)))

  const openNew = () => {
    setOutletId(lockedOutlet ?? activeOutletId); setCustomerName(''); setCustomerAddress(''); setCustomerPhone(''); setSourcePhone('')
    setSalesId(me?.employeeId ?? ''); setOrderDate(new Date().toISOString().slice(0, 10))
    setBankName(''); setBankRef(''); setShippingCost(0); setNotes('')
    setItems([{ product_id: '', qty: 1 }]); setOpen(true)
  }

  const create = () => {
    if (lockedOutlet === '__none__') { toast.error('Akun kamu belum ditetapkan cabangnya — hubungi owner.'); return }
    if (!customerName.trim()) { toast.error('Nama customer wajib diisi'); return }
    const od = new Date(orderDate)
    if (!orderDate || Number.isNaN(od.getTime())) { toast.error('Tanggal wajib diisi'); return }
    const valid = items.filter((i) => i.product_id && i.qty > 0)
    if (!valid.length) { toast.error('Tambah minimal 1 barang dengan qty > 0'); return }
    // gabung qty bila produk sama dipilih dua kali
    const merged = new Map<string, number>()
    for (const i of valid) merged.set(i.product_id, (merged.get(i.product_id) ?? 0) + i.qty)
    const docId = generateId('so')
    const docItems: SalesOrderItem[] = [...merged.entries()].map(([pid, qty]) => {
      const prod = products.find((p) => p.id === pid)
      const price = prod?.price ?? 0
      return { id: generateId('soi'), sales_order_id: docId, product_id: pid, product_name: prod?.name ?? '-', qty, price, subtotal: qty * price }
    })
    const subtotal = docItems.reduce((s, i) => s + i.subtotal, 0)
    // Peringatan dobel: cek surat pesanan aktif di cabang sama, 7 hari terakhir, barang+jumlah persis sama.
    const outletForDoc = lockedOutlet ?? outletId
    const sig = docItems.map((i) => `${i.product_id}:${i.qty}`).sort().join('|')
    const weekAgo = Date.now() - 7 * 86400000
    const twin = salesOrders.find((d) => d.status !== 'cancelled' && d.outlet_id === outletForDoc
      && new Date(d.created_at).getTime() >= weekAgo && itemsSig(d.items) === sig)
    if (twin && !confirm(`⚠ PESANAN MUNGKIN DOBEL\n\nSudah ada surat pesanan dengan barang & jumlah PERSIS SAMA:\n• ${twin.number} — ${twin.customer_name} (${formatDate(twin.order_date)})\n  HP: ${twin.customer_phone || '-'}${twin.source_phone ? ` · asal pesanan: ${twin.source_phone}` : ''}${twin.created_by_name ? ` · diinput: ${twin.created_by_name}` : ''}\n\nBisa jadi ini pesanan yang sama dari nomor berbeda. Tetap buat surat pesanan baru?`)) return
    const salesName = employees.find((e) => e.id === salesId)?.name || me?.name || undefined
    const doc: SalesOrder = {
      id: docId, number: genNo(salesOrders), outlet_id: lockedOutlet ?? outletId,
      customer_name: customerName.trim(),
      customer_address: customerAddress.trim() || undefined,
      customer_phone: customerPhone.trim() || undefined,
      order_date: od.toISOString(),
      sales_name: salesName, sales_id: salesId || undefined,
      source_phone: sourcePhone.trim() || undefined,
      created_by_name: me?.name || undefined,
      bank_name: bankName.trim() || undefined, bank_ref: bankRef.trim() || undefined,
      shipping_cost: Number(shippingCost) || 0, subtotal, total: subtotal + (Number(shippingCost) || 0),
      items: docItems, status: 'draft', notes: notes.trim() || undefined,
      created_at: new Date().toISOString(),
    }
    addSalesOrder(doc)
    toast.success(`Surat Pesanan ${doc.number} dibuat`)
    setOpen(false)
  }

  const changeStatus = (doc: SalesOrder, status: SalesOrderStatus, msg: string) => { setStatus(doc.id, status); toast.success(msg); setDetailSel(null) }
  const remove = (doc: SalesOrder) => {
    if (!confirm(`Hapus Surat Pesanan ${doc.number}?`)) return
    deleteSalesOrder(doc.id); toast.success('Surat Pesanan dihapus'); setDetailSel(null)
  }
  const handlePrint = () => { if (typeof window !== 'undefined') window.print() }

  const FILTERS: { value: 'all' | SalesOrderStatus; label: string }[] = [
    { value: 'all', label: 'Semua' }, { value: 'draft', label: 'Draft' }, { value: 'confirmed', label: 'Dikonfirmasi' }, { value: 'done', label: 'Selesai' }, { value: 'cancelled', label: 'Batal' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText size={22} /> Surat Pesanan</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {canManage ? 'Buat & kelola surat pesanan pelanggan (order penjualan). Tidak mengurangi stok.' : 'Lihat surat pesanan yang dibuat sales (mode lihat saja).'}
          </p>
        </div>
        {canManage && <Button onClick={openNew} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"><Plus size={16} /> Buat Surat Pesanan</Button>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{branchOrders.length}</p><p className="text-xs text-muted-foreground mt-0.5">Total Surat Pesanan</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-emerald-600">{doneCount}</p><p className="text-xs text-muted-foreground mt-0.5">Selesai</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{formatRupiah(totalValue)}</p><p className="text-xs text-muted-foreground mt-0.5">Total Nilai (aktif)</p></CardContent></Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Button key={f.value} size="sm" variant={filter === f.value ? 'default' : 'outline'}
            className={`text-xs ${filter === f.value ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
            onClick={() => setFilter(f.value)}>{f.label}</Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                  {['No. SP', 'Pelanggan', 'Sales', 'Item', 'Total', 'Tanggal', 'Status', 'Aksi'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-3 px-4 font-mono text-xs font-semibold">{d.number}</td>
                    <td className="py-3 px-4 text-xs font-medium">{d.customer_name}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{d.sales_name ?? '—'}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{d.items.length} item</td>
                    <td className="py-3 px-4 font-bold">{formatRupiah(d.total)}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{formatDate(d.order_date)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={`text-xs ${STATUS_BADGE[d.status]}`}>{SALES_ORDER_STATUS[d.status].label}</Badge>
                        {isDup(d) && <Badge variant="outline" className="text-xs gap-1 bg-amber-100 text-amber-700 border-amber-300" title="Barang & jumlah sama dengan surat pesanan lain — cek jangan sampai dobel"><AlertTriangle size={10} /> Mungkin dobel</Badge>}
                      </div>
                    </td>
                    <td className="py-3 px-4"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailSel({ id: d.id, number: d.number })}><Eye size={13} /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="py-16 text-center"><FileText size={36} className="mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">Belum ada surat pesanan</p></div>}
          </div>
        </CardContent>
      </Card>

      {/* Detail — dokumen (bisa dicetak) */}
      <Dialog open={!!detail} onOpenChange={() => setDetailSel(null)}>
        <DialogContent showCloseButton={false} className="sm:max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0">
          {detail && (
            <>
              <div className="flex items-center justify-between gap-2 px-5 py-3 border-b sticky top-0 bg-background z-10 print:hidden">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={17} className="shrink-0" />
                  <span className="font-mono font-semibold text-sm truncate">{detail.number}</span>
                  <Badge variant="outline" className={`text-xs ${STATUS_BADGE[detail.status]}`}>{SALES_ORDER_STATUS[detail.status].label}</Badge>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {canManage && detail.status === 'draft' && (
                    <Button size="sm" disabled={isPending(detail)} className="h-8 gap-1.5 bg-blue-600 text-white hover:bg-blue-700" onClick={() => changeStatus(detail, 'confirmed', 'Surat pesanan dikonfirmasi')}><Send size={14} /> Konfirmasi</Button>
                  )}
                  {canManage && detail.status === 'confirmed' && (
                    <Button size="sm" disabled={isPending(detail)} className="h-8 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => changeStatus(detail, 'done', 'Surat pesanan selesai')}><CheckCircle2 size={14} /> Selesai</Button>
                  )}
                  {canManage && (detail.status === 'draft' || detail.status === 'confirmed') && (
                    <Button size="sm" variant="outline" disabled={isPending(detail)} className="h-8 gap-1.5" onClick={() => changeStatus(detail, 'cancelled', 'Surat pesanan dibatalkan')}><X size={14} /> Batal</Button>
                  )}
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={handlePrint}><Printer size={14} /> Cetak</Button>
                  {/* Hapus: owner bebas; sales/manager hanya boleh hapus DRAFT (dokumen jalan/selesai tak boleh raib tanpa jejak) */}
                  {canManage && (isOwner || detail.status === 'draft') && <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" disabled={isPending(detail)} onClick={() => remove(detail)}><Trash2 size={14} /></Button>}
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setDetailSel(null)}><X size={15} /></Button>
                </div>
              </div>
              {isPending(detail) && <p className="px-5 py-2 text-xs text-amber-600 print:hidden">Menyimpan dokumen… tunggu sebentar.</p>}
              <div className="p-5 bg-muted/20">
                <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                  <SalesOrderDocument doc={detail} />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Buat Surat Pesanan */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Buat Surat Pesanan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nama Customer *</Label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nama pelanggan" /></div>
              <div className="space-y-2"><Label>No. HP</Label><Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="08xxxx" inputMode="tel" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Alamat Penerima</Label><Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Alamat pengiriman" /></div>
              <div className="space-y-2">
                <Label>No. HP Asal Pesanan</Label>
                <Input value={sourcePhone} onChange={(e) => setSourcePhone(e.target.value)} placeholder="Nomor yang dipakai memesan/chat" inputMode="tel" />
                <p className="text-[11px] text-muted-foreground">Isi bila beda dari No. HP customer — membantu melacak pesanan dobel dari 2 nomor.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Sales</Label>
                <select value={salesId} onChange={(e) => setSalesId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">— pilih —</option>
                  {activeEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Outlet</Label>
                <select value={lockedOutlet ?? outletId} onChange={(e) => setOutletId(e.target.value)} disabled={!!lockedOutlet}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-70">
                  {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>Tanggal</Label><Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nama Bank</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="mis. BCA" /></div>
              <div className="space-y-2"><Label>No. Ref / Rekening Bank</Label><Input value={bankRef} onChange={(e) => setBankRef(e.target.value)} placeholder="No. rekening / referensi" /></div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center text-xs font-semibold text-muted-foreground px-1">
                <span className="flex-1">Barang</span><span className="w-28 text-right">Harga</span><span className="w-20 text-right">Qty</span><span className="w-28 text-right">Subtotal</span><span className="w-8" />
              </div>
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1"><ProductCombobox products={products} value={it.product_id} onChange={(pid) => setItem(i, { product_id: pid })} /></div>
                  <span className="w-28 text-right text-xs tabular-nums text-muted-foreground">{it.product_id ? formatRupiah(priceOf(it.product_id)) : '—'}</span>
                  <Input type="number" min={1} className="w-20 text-right" value={it.qty || ''} onChange={(e) => setItem(i, { qty: Math.max(0, Number(e.target.value) || 0) })} />
                  <span className="w-28 text-right text-sm tabular-nums">{formatRupiah((it.qty || 0) * priceOf(it.product_id))}</span>
                  <button type="button" onClick={() => removeItem(i)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30" disabled={items.length <= 1}><X size={14} /></button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={addItem}><Plus size={13} /> Tambah Barang</Button>
            </div>

            <div className="flex justify-end">
              <div className="w-64 space-y-1.5">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatRupiah(itemsSubtotal)}</span></div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Ongkir</span>
                  <Input type="number" min={0} className="w-32 h-8 text-right" value={shippingCost || ''} onChange={(e) => setShippingCost(Math.max(0, Number(e.target.value) || 0))} />
                </div>
                <div className="flex justify-between font-bold text-lg pt-1 border-t"><span>Total</span><span className="tabular-nums">{formatRupiah(formTotal)}</span></div>
              </div>
            </div>
            <div className="space-y-2"><Label>Catatan (opsional)</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={create} className="bg-primary text-primary-foreground hover:bg-primary/90">Buat Surat Pesanan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
