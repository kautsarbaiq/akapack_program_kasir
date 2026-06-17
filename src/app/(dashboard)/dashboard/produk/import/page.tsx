'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Upload, Download, FileSpreadsheet, ArrowLeft, Boxes } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ImportProdukDialog } from '@/components/dashboard/import-produk-dialog'
import { useProductStore } from '@/stores/use-product-store'
import { toast } from 'sonner'

export default function ImportExportProdukPage() {
  const products = useProductStore((s) => s.products)
  const [importOpen, setImportOpen] = useState(false)

  const handleExport = async () => {
    if (products.length === 0) { toast.error('Belum ada produk untuk diekspor'); return }
    const XLSX = await import('xlsx')
    const rows = products.map((p) => ({
      name: p.name,
      category: p.category?.name ?? '',
      sku: p.sku,
      barcode: p.barcode ?? '',
      buy_price: p.cost_price,
      sell_price: p.price_online || p.price,
      pos_sell_price: p.price,
      stock_qty: p.stock,
      uom: p.unit,
      published: p.is_active ? 1 : 0,
      description: p.description ?? '',
      photo_1: p.image_url ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'product')
    XLSX.writeFile(wb, `katalog-produk-${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success(`${products.length} produk diekspor`)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/dashboard/produk" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mb-2"><ArrowLeft size={14} /> Kembali ke Katalog</Link>
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileSpreadsheet size={22} /> Import / Export Produk</h1>
        <p className="text-muted-foreground text-sm mt-1">Tambah ribuan produk sekaligus dari file Excel/CSV, atau ekspor katalog untuk dicadangkan.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="hover:border-primary/40 transition-colors">
          <CardContent className="p-6 space-y-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Upload size={20} /></div>
            <div>
              <p className="font-semibold">Import Katalog</p>
              <p className="text-sm text-muted-foreground mt-1">Buat produk massal dari file (mendukung format ekspor Olsera: kategori, harga beli/jual, stok, foto). Kategori dibuat otomatis.</p>
            </div>
            <Button onClick={() => setImportOpen(true)} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"><Upload size={15} /> Pilih File & Import</Button>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/40 transition-colors">
          <CardContent className="p-6 space-y-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><Download size={20} /></div>
            <div>
              <p className="font-semibold">Export Katalog</p>
              <p className="text-sm text-muted-foreground mt-1">Unduh semua {products.length} produk ke file .xlsx. Bisa diedit lalu di-import ulang untuk memperbarui harga.</p>
            </div>
            <Button variant="outline" onClick={handleExport} className="gap-1.5"><Download size={15} /> Export .xlsx</Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-5 text-sm space-y-2">
          <p className="font-semibold flex items-center gap-1.5"><Boxes size={15} /> Kolom yang dikenali</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            <span className="font-mono">name</span> (wajib), <span className="font-mono">category</span>, <span className="font-mono">sku</span>, <span className="font-mono">barcode</span>,
            {' '}<span className="font-mono">buy_price</span> (modal), <span className="font-mono">sell_price</span> / <span className="font-mono">pos_sell_price</span> (jual),
            {' '}<span className="font-mono">stock_qty</span>, <span className="font-mono">uom</span> (satuan), <span className="font-mono">description</span>, <span className="font-mono">photo_1</span>, <span className="font-mono">published</span>.
            {' '}Header Bahasa Indonesia (nama, kategori, harga beli, harga jual, stok, satuan) juga dikenali.
          </p>
        </CardContent>
      </Card>

      <ImportProdukDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
