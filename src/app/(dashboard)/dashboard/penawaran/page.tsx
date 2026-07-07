'use client'

import { useState, useMemo } from 'react'
import { FileSpreadsheet, Plus, Eye, X, Trash2, Printer, CheckCircle2, Send, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ProductCombobox } from '@/components/dashboard/product-combobox'
import { QuotationDocument, QUOTATION_STATUS } from '@/components/dashboard/quotation-document'
import { useQuotationStore } from '@/stores/use-quotation-store'
import { useProductStore } from '@/stores/use-product-store'
import { useOutletStore } from '@/stores/use-outlet-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useSettingsStore } from '@/stores/use-settings-store'
import { useRole, useCurrentUserStore } from '@/stores/use-current-user-store'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { formatRupiah, formatDate, generateId, localDay } from '@/lib/utils'
import type { Quotation, QuotationItem, QuotationStatus } from '@/types'
import { toast } from 'sonner'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isPending = (d: Quotation) => isSupabaseConfigured() && !UUID_RE.test(d.id)

const STATUS_BADGE: Record<QuotationStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  accepted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-100 text-red-600 border-red-200',
}

// QTN-{urut}/{DDMMYYYY} — urut global dari MAX yang ada (lanjut dari penomoran manual toko).
function genQtnNo(existing: { number: string }[], dateStr: string) {
  const max = existing.reduce((mx, d) => {
    const m = /^QTN-(\d+)\//.exec(d.number || '')
    return m ? Math.max(mx, parseInt(m[1], 10)) : mx
  }, 0)
  const [y, mo, da] = dateStr.split('-')
  return `QTN-${max + 1}/${da}${mo}${y}`
}

type DraftItem = { product_id: string; qty: number; unit_price: number }

export default function PenawaranPage() {
  const quotations = useQuotationStore((s) => s.quotations)
  const addQuotation = useQuotationStore((s) => s.addQuotation)
  const setStatus = useQuotationStore((s) => s.setStatus)
  const deleteQuotation = useQuotationStore((s) => s.deleteQuotation)
  const products = useProductStore((s) => s.products)
  const outlets = useOutletStore((s) => s.outlets)
  const activeOutletId = useActiveOutletStore((s) => s.activeOutletId)
  const bankInfo = useSettingsStore((s) => s.bankInfo)
  const { isOwner, isManager, isCashier } = useRole()
  const me = useCurrentUserStore((s) => s.user)

  // Kasir = lihat saja. Owner/manager/sales = kelola. Sales/kasir dikunci cabang (fail-closed tanpa cabang).
  const canManage = !isCashier
  const lockedOutlet = (!isOwner && !isManager) ? (me?.outletId ?? '__none__') : null

  const [filter, setFilter] = useState<'all' | QuotationStatus>('all')
  const [detailSel, setDetailSel] = useState<{ id: string; number: string } | null>(null)
  const [open, setOpen] = useState(false)

  // form
  const [outletId, setOutletId] = useState(activeOutletId)
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [quoteDate, setQuoteDate] = useState(localDay(new Date()))
  const [number, setNumber] = useState('')
  const [terms, setTerms] = useState('Harga belum termasuk pajak')
  const [bankField, setBankField] = useState('')
  const [items, setItems] = useState<DraftItem[]>([{ product_id: '', qty: 1, unit_price: 0 }])

  const branchDocs = useMemo(
    () => (lockedOutlet ? quotations.filter((d) => d.outlet_id === lockedOutlet) : quotations),
    [quotations, lockedOutlet]
  )
  const filtered = useMemo(
    () => (filter === 'all' ? branchDocs : branchDocs.filter((d) => d.status === filter)),
    [branchDocs, filter]
  )
  const detail = detailSel
    ? branchDocs.find((d) => d.id === detailSel.id) ?? branchDocs.find((d) => d.number === detailSel.number) ?? null
    : null

  const dealCount = branchDocs.filter((d) => d.status === 'accepted').length
  const totalValue = branchDocs.filter((d) => d.status !== 'rejected').reduce((s, d) => s + d.total, 0)
  const formTotal = items.reduce((s, i) => s + (i.qty || 0) * (i.unit_price || 0), 0)

  const setItem = (idx: number, patch: Partial<DraftItem>) => setItems((ls) => ls.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  const onPickProduct = (idx: number, pid: string) => {
    const prod = products.find((p) => p.id === pid)
    setItem(idx, { product_id: pid, unit_price: prod?.price ?? 0 }) // harga katalog sbg awal — bisa dinego/diedit
  }
  const addItem = () => setItems((ls) => [...ls, { product_id: '', qty: 1, unit_price: 0 }])
  const removeItem = (idx: number) => setItems((ls) => (ls.length <= 1 ? ls : ls.filter((_, i) => i !== idx)))

  const openNew = () => {
    setOutletId(lockedOutlet && lockedOutlet !== '__none__' ? lockedOutlet : activeOutletId)
    setCustomerName(''); setCustomerAddress('')
    const today = localDay(new Date())
    setQuoteDate(today); setNumber(genQtnNo(quotations, today))
    setTerms('Harga belum termasuk pajak'); setBankField(bankInfo || '')
    setItems([{ product_id: '', qty: 1, unit_price: 0 }]); setOpen(true)
  }

  const create = () => {
    if (lockedOutlet === '__none__') { toast.error('Akun kamu belum ditetapkan cabangnya — hubungi owner.'); return }
    if (!customerName.trim()) { toast.error('Nama customer wajib diisi'); return }
    const qd = new Date(quoteDate)
    if (!quoteDate || Number.isNaN(qd.getTime())) { toast.error('Tanggal wajib diisi'); return }
    if (!number.trim()) { toast.error('Nomor penawaran wajib diisi'); return }
    const valid = items.filter((i) => i.product_id && i.qty > 0)
    if (!valid.length) { toast.error('Tambah minimal 1 barang dengan qty > 0'); return }
    const docId = generateId('qtn')
    const docItems: QuotationItem[] = valid.map((i) => {
      const prod = products.find((p) => p.id === i.product_id)
      return { id: generateId('qti'), quotation_id: docId, product_id: i.product_id, description: prod?.name ?? '-', unit_price: i.unit_price || 0, qty: i.qty, total: (i.unit_price || 0) * i.qty }
    })
    const doc: Quotation = {
      id: docId, number: number.trim(), outlet_id: lockedOutlet ?? outletId,
      customer_name: customerName.trim(),
      customer_address: customerAddress.trim() || undefined,
      quote_date: qd.toISOString(),
      total: docItems.reduce((s, i) => s + i.total, 0),
      terms: terms.trim() || undefined,
      bank_info: bankField.trim() || undefined,
      created_by_name: me?.name || undefined,
      items: docItems, status: 'draft', created_at: new Date().toISOString(),
    }
    addQuotation(doc)
    toast.success(`Penawaran ${doc.number} dibuat`)
    setOpen(false)
  }

  const changeStatus = (doc: Quotation, status: QuotationStatus, msg: string) => { setStatus(doc.id, status); toast.success(msg); setDetailSel(null) }
  const remove = (doc: Quotation) => {
    if (!confirm(`Hapus Penawaran ${doc.number}?`)) return
    deleteQuotation(doc.id); toast.success('Penawaran dihapus'); setDetailSel(null)
  }
  const handlePrint = () => { if (typeof window !== 'undefined') window.print() }

  const FILTERS: { value: 'all' | QuotationStatus; label: string }[] = [
    { value: 'all', label: 'Semua' }, { value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Terkirim' }, { value: 'accepted', label: 'Deal' }, { value: 'rejected', label: 'Ditolak' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileSpreadsheet size={22} /> Penawaran (Quotation)</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {canManage ? 'Buat surat penawaran harga untuk customer. Tidak menyentuh stok.' : 'Lihat penawaran yang dibuat sales (mode lihat saja).'}
          </p>
        </div>
        {canManage && <Button onClick={openNew} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"><Plus size={16} /> Buat Penawaran</Button>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{branchDocs.length}</p><p className="text-xs text-muted-foreground mt-0.5">Total Penawaran</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-emerald-600">{dealCount}</p><p className="text-xs text-muted-foreground mt-0.5">Deal</p></CardContent></Card>
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
                  {['No. QTN', 'Pelanggan', 'Item', 'Total', 'Tanggal', 'Dibuat', 'Status', 'Aksi'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-3 px-4 font-mono text-xs font-semibold">{d.number}</td>
                    <td className="py-3 px-4 text-xs font-medium">{d.customer_name}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{d.items.length} item</td>
                    <td className="py-3 px-4 font-bold">{formatRupiah(d.total)}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{formatDate(d.quote_date)}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{d.created_by_name ?? '—'}</td>
                    <td className="py-3 px-4"><Badge variant="outline" className={`text-xs ${STATUS_BADGE[d.status]}`}>{QUOTATION_STATUS[d.status].label}</Badge></td>
                    <td className="py-3 px-4"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailSel({ id: d.id, number: d.number })}><Eye size={13} /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="py-16 text-center"><FileSpreadsheet size={36} className="mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">Belum ada penawaran</p></div>}
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
                  <FileSpreadsheet size={17} className="shrink-0" />
                  <span className="font-mono font-semibold text-sm truncate">{detail.number}</span>
                  <Badge variant="outline" className={`text-xs ${STATUS_BADGE[detail.status]}`}>{QUOTATION_STATUS[detail.status].label}</Badge>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {canManage && detail.status === 'draft' && (
                    <Button size="sm" disabled={isPending(detail)} className="h-8 gap-1.5 bg-blue-600 text-white hover:bg-blue-700" onClick={() => changeStatus(detail, 'sent', 'Penawaran ditandai terkirim')}><Send size={14} /> Terkirim</Button>
                  )}
                  {canManage && detail.status === 'sent' && (
                    <>
                      <Button size="sm" disabled={isPending(detail)} className="h-8 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => changeStatus(detail, 'accepted', 'Deal! Penawaran diterima customer')}><CheckCircle2 size={14} /> Deal</Button>
                      <Button size="sm" variant="outline" disabled={isPending(detail)} className="h-8 gap-1.5" onClick={() => changeStatus(detail, 'rejected', 'Penawaran ditandai ditolak')}><XCircle size={14} /> Ditolak</Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={handlePrint}><Printer size={14} /> Cetak</Button>
                  {canManage && (isOwner || detail.status === 'draft') && <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" disabled={isPending(detail)} onClick={() => remove(detail)}><Trash2 size={14} /></Button>}
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setDetailSel(null)}><X size={15} /></Button>
                </div>
              </div>
              {isPending(detail) && <p className="px-5 py-2 text-xs text-amber-600 print:hidden">Menyimpan dokumen… tunggu sebentar.</p>}
              <div className="p-5 bg-muted/20">
                <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                  <QuotationDocument doc={detail} />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Buat Penawaran */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Buat Penawaran (Quotation)</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nama Customer *</Label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="mis. PT Herlinah Cipta Pratama" /></div>
              <div className="space-y-2"><Label>Alamat (opsional)</Label><Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Di Tempat" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>No. Penawaran</Label><Input value={number} onChange={(e) => setNumber(e.target.value)} className="font-mono text-xs" /></div>
              <div className="space-y-2"><Label>Tanggal</Label><Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Outlet</Label>
                <select value={lockedOutlet && lockedOutlet !== '__none__' ? lockedOutlet : outletId} onChange={(e) => setOutletId(e.target.value)} disabled={!!lockedOutlet}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-70">
                  {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center text-xs font-semibold text-muted-foreground px-1">
                <span className="flex-1">Barang</span><span className="w-28 text-right">Unit Price</span><span className="w-20 text-right">Qty</span><span className="w-28 text-right">Total</span><span className="w-8" />
              </div>
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1"><ProductCombobox products={products} value={it.product_id} onChange={(pid) => onPickProduct(i, pid)} /></div>
                  <Input type="number" min={0} className="w-28 text-right" value={it.unit_price || ''} onChange={(e) => setItem(i, { unit_price: Math.max(0, Number(e.target.value) || 0) })} title="Harga nego per unit" />
                  <Input type="number" min={1} className="w-20 text-right" value={it.qty || ''} onChange={(e) => setItem(i, { qty: Math.max(0, Number(e.target.value) || 0) })} />
                  <span className="w-28 text-right text-sm tabular-nums">{formatRupiah((it.qty || 0) * (it.unit_price || 0))}</span>
                  <button type="button" onClick={() => removeItem(i)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30" disabled={items.length <= 1}><X size={14} /></button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={addItem}><Plus size={13} /> Tambah Barang</Button>
              <p className="text-[11px] text-muted-foreground">Harga terisi otomatis dari katalog saat barang dipilih — bisa diubah (harga nego).</p>
            </div>

            <div className="flex justify-end">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total Penawaran</p>
                <p className="text-xl font-bold tabular-nums">{formatRupiah(formTotal)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Catatan (1 baris = 1 poin)</Label>
                <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-2">
                <Label>Pembayaran Transfer</Label>
                <textarea value={bankField} onChange={(e) => setBankField(e.target.value)} rows={2} placeholder="mis. BCA Nurbuati Ratna Gumilang 8090488458"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={create} className="bg-primary text-primary-foreground hover:bg-primary/90">Buat Penawaran</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
