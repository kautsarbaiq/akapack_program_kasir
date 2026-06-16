'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Package, Wand2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { useCategoryStore } from '@/stores/use-category-store'
import { useProductStore } from '@/stores/use-product-store'
import { useVariantStore } from '@/stores/use-variant-store'
import { uploadProductImage } from '@/lib/supabase/storage'
import { generateSKU, formatRupiah } from '@/lib/utils'
import { productSchema, type ProductFormValues } from '@/lib/validations'
import type { Product, ProductUnit, PriceTier } from '@/types'

const UNITS = ['pcs', 'buah', 'unit', 'kg', 'gram', 'liter', 'ml', 'lusin', 'karton', 'box', 'pack', 'roll', 'meter', 'lembar']

type VariantRow = { id?: string; name: string; price: number; cost_price: number; stock: number }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product | null
  onSuccess?: () => void
}

export function ProductFormDialog({ open, onOpenChange, product, onSuccess }: Props) {
  const isEdit = !!product
  const categories = useCategoryStore((s) => s.categories)
  const addProduct = useProductStore((s) => s.addProduct)
  const updateProduct = useProductStore((s) => s.updateProduct)
  const setHasVariants = useProductStore((s) => s.setHasVariants)
  const setProductImage = useProductStore((s) => s.setProductImage)
  const addVariant = useVariantStore((s) => s.addVariant)
  const updateVariant = useVariantStore((s) => s.updateVariant)
  const deleteVariant = useVariantStore((s) => s.deleteVariant)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '', category_id: '', sku: '', barcode: '', description: '',
      price: 0, cost_price: 0, stock: 0, min_stock: 5,
      unit: 'pcs', is_active: true,
    },
  })

  const price = watch('price')
  const costPrice = watch('cost_price')
  const categoryId = watch('category_id')
  const unit = watch('unit')
  const isActive = watch('is_active')
  const unitBase = watch('unit')
  const margin = price > 0 ? Math.round(((price - costPrice) / price) * 100) : 0
  const [units, setUnits] = useState<ProductUnit[]>([])
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([])
  const [priceOnline, setPriceOnline] = useState(0)
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [hasVariants, setHasVariantsLocal] = useState(false)
  const [variantRows, setVariantRows] = useState<VariantRow[]>([])

  useEffect(() => {
    if (open) {
      if (product) {
        reset({
          name: product.name,
          category_id: product.category_id,
          sku: product.sku,
          barcode: product.barcode ?? '',
          description: product.description ?? '',
          price: product.price,
          cost_price: product.cost_price,
          stock: product.stock,
          min_stock: product.min_stock,
          unit: product.unit,
          is_active: product.is_active,
        })
      } else {
        reset({
          name: '', category_id: '', sku: generateSKU('PRD'), barcode: '', description: '',
          price: 0, cost_price: 0, stock: 0, min_stock: 5, unit: 'pcs', is_active: true,
        })
      }
      setUnits(product?.units ?? [])
      setPriceTiers(product?.price_tiers ?? [])
      setPriceOnline(product?.price_online ?? 0)
      setImageUrl(product?.image_url ?? '')
      const existingVars = product ? useVariantStore.getState().byProduct(product.id) : []
      setVariantRows(existingVars.map((v) => ({ id: v.id, name: v.name, price: v.price, cost_price: v.cost_price, stock: v.stock })))
      setHasVariantsLocal(product?.has_variants ?? existingVars.length > 0)
    }
  }, [open, product, reset])

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const url = await uploadProductImage(file)
    setUploading(false)
    if (url) { setImageUrl(url); toast.success('Foto terupload') }
    else toast.error('Gagal upload — pastikan migration 0008 (Storage) sudah dijalankan')
  }

  const onSubmit = async (data: ProductFormValues) => {
    await new Promise((r) => setTimeout(r, 400))
    const cleanUnits = units.filter((u) => u.name.trim() && u.factor > 0)
    const cleanTiers = priceTiers.filter((t) => t.min_qty > 0 && t.price > 0)

    let productId: string
    if (isEdit && product) {
      productId = product.id
      updateProduct(product.id, data, cleanUnits, cleanTiers, priceOnline)
    } else {
      productId = addProduct(data, cleanUnits, cleanTiers, priceOnline).id
    }

    // Persist varian (diff: hapus yang dibuang, update yang ada, tambah yang baru)
    const cleanRows = hasVariants ? variantRows.filter((r) => r.name.trim()) : []
    const original = useVariantStore.getState().byProduct(productId)
    original.forEach((o) => { if (!cleanRows.some((r) => r.id === o.id)) deleteVariant(o.id) })
    cleanRows.forEach((r) => {
      const vdata = { name: r.name, price: r.price, cost_price: r.cost_price, stock: r.stock }
      if (r.id) updateVariant(r.id, vdata)
      else addVariant(productId, vdata)
    })
    setHasVariants(productId, cleanRows.length > 0)
    if (imageUrl !== (product?.image_url ?? '')) setProductImage(productId, imageUrl)

    toast.success(isEdit ? `Produk "${data.name}" berhasil diperbarui` : `Produk "${data.name}" berhasil ditambahkan`)
    onOpenChange(false)
    onSuccess?.()
  }

  const handleGenerateSKU = () => {
    const name = watch('name')
    const prefix = name ? name.slice(0, 3).toUpperCase() : 'PRD'
    setValue('sku', generateSKU(prefix))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package size={18} />
            {isEdit ? 'Edit Produk' : 'Tambah Produk Baru'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Tabs defaultValue="info">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">Info Dasar</TabsTrigger>
              <TabsTrigger value="harga" className="flex-1">Harga & Stok</TabsTrigger>
              <TabsTrigger value="varian" className="flex-1">Varian</TabsTrigger>
              <TabsTrigger value="foto" className="flex-1">Foto</TabsTrigger>
            </TabsList>

            {/* Tab Info Dasar */}
            <TabsContent value="info" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nama Produk *</Label>
                <Input placeholder="Contoh: Kaos Polos Premium" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Kategori *</Label>
                <Select value={categoryId} onValueChange={(v) => { if (v) setValue('category_id', v, { shouldValidate: true }) }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category_id && <p className="text-xs text-destructive">{errors.category_id.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SKU *</Label>
                  <div className="flex gap-2">
                    <Input placeholder="PRD-001" {...register('sku')} />
                    <Button type="button" variant="outline" size="icon" onClick={handleGenerateSKU} title="Auto-generate SKU">
                      <Wand2 size={15} />
                    </Button>
                  </div>
                  {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Barcode</Label>
                  <Input placeholder="Scan atau ketik barcode" {...register('barcode')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Deskripsi produk (opsional)"
                  {...register('description')}
                />
              </div>

              <div className="space-y-2">
                <Label>Satuan *</Label>
                <Select value={unit} onValueChange={(v) => { if (v) setValue('unit', v) }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih satuan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
              </div>

              <div className="flex items-center justify-between py-2 rounded-lg px-3 bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Status Produk</p>
                  <p className="text-xs text-muted-foreground">Produk {isActive ? 'aktif' : 'tidak aktif'} di katalog</p>
                </div>
                <Switch checked={isActive} onCheckedChange={(v) => setValue('is_active', v)} />
              </div>
            </TabsContent>

            {/* Tab Harga & Stok */}
            <TabsContent value="harga" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Harga Jual *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
                    <Input type="number" className="pl-9" placeholder="0" {...register('price', { valueAsNumber: true })} />
                  </div>
                  {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>HPP (Harga Pokok)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
                    <Input type="number" className="pl-9" placeholder="0" {...register('cost_price', { valueAsNumber: true })} />
                  </div>
                  {errors.cost_price && <p className="text-xs text-destructive">{errors.cost_price.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Harga Jual Online (opsional)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
                  <Input type="number" className="pl-9" placeholder="Kosong = sama dengan harga toko"
                    value={priceOnline || ''} onChange={(e) => setPriceOnline(Number(e.target.value) || 0)} />
                </div>
                <p className="text-xs text-muted-foreground">Dipakai di toko online (/toko). Isi 0 = pakai harga jual toko.</p>
              </div>

              {/* Margin preview */}
              {price > 0 && (
                <div className="rounded-xl p-4 space-y-2 text-sm bg-primary/5 border border-primary/15">
                  <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Kalkulasi Margin</p>
                  <div className="flex justify-between"><span>Harga Jual</span><span className="font-medium">{formatRupiah(price)}</span></div>
                  <div className="flex justify-between"><span>HPP</span><span className="font-medium">{formatRupiah(costPrice)}</span></div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Profit</span>
                    <span style={{ color: margin >= 20 ? 'oklch(0.55 0.18 160)' : margin >= 10 ? 'oklch(0.6 0.18 85)' : 'oklch(0.65 0.2 30)' }}>
                      {formatRupiah(price - costPrice)} ({margin}%)
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Stok Awal *</Label>
                  <Input type="number" placeholder="0" {...register('stock', { valueAsNumber: true })} />
                  {errors.stock && <p className="text-xs text-destructive">{errors.stock.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Stok Minimum Alert</Label>
                  <Input type="number" placeholder="5" {...register('min_stock', { valueAsNumber: true })} />
                  <p className="text-xs text-muted-foreground">Notif saat stok di bawah angka ini</p>
                </div>
              </div>

              <Separator />

              {/* Satuan tambahan (multi-unit) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Satuan Tambahan (opsional)</Label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => setUnits((u) => [...u, { name: '', factor: 1, price: 0 }])}>
                    <Wand2 size={13} /> Tambah Satuan
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Mis. 1 Dus = 100 {unitBase || 'pcs'}. Stok dasar berkurang sesuai isi saat terjual.</p>
                {units.map((u, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input placeholder="Nama (mis. Dus)" className="h-8 flex-1" value={u.name}
                      onChange={(e) => setUnits((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <Input type="number" placeholder="Isi" className="h-8 w-16" value={u.factor || ''}
                      onChange={(e) => setUnits((arr) => arr.map((x, j) => (j === i ? { ...x, factor: Number(e.target.value) || 0 } : x)))} />
                    <div className="relative w-28">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                      <Input type="number" placeholder="Harga" className="h-8 pl-7" value={u.price || ''}
                        onChange={(e) => setUnits((arr) => arr.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) || 0 } : x)))} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                      onClick={() => setUnits((arr) => arr.filter((_, j) => j !== i))}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Harga grosir bertingkat */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Harga Grosir (opsional)</Label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => setPriceTiers((t) => [...t, { min_qty: 0, price: 0 }])}>
                    <Wand2 size={13} /> Tambah Tingkat
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Beli ≥ jumlah tertentu ({unitBase || 'pcs'}) → harga per {unitBase || 'pcs'} otomatis lebih murah di kasir.</p>
                {priceTiers.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">Min</span>
                    <Input type="number" placeholder="Qty" className="h-8 w-20" value={t.min_qty || ''}
                      onChange={(e) => setPriceTiers((arr) => arr.map((x, j) => (j === i ? { ...x, min_qty: Number(e.target.value) || 0 } : x)))} />
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                      <Input type="number" placeholder="Harga / unit" className="h-8 pl-7" value={t.price || ''}
                        onChange={(e) => setPriceTiers((arr) => arr.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) || 0 } : x)))} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                      onClick={() => setPriceTiers((arr) => arr.filter((_, j) => j !== i))}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Tab Foto */}
            <TabsContent value="foto" className="pt-4 space-y-3">
              {imageUrl ? (
                <div className="space-y-3">
                  <div className="aspect-square max-w-[240px] mx-auto rounded-2xl overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="Foto produk" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex justify-center gap-2">
                    <label className="cursor-pointer inline-flex items-center h-9 px-3 rounded-md border text-sm hover:bg-muted">
                      <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
                      Ganti Foto
                    </label>
                    <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setImageUrl('')}>Hapus</Button>
                  </div>
                </div>
              ) : (
                <label className="block border-2 border-dashed rounded-2xl p-12 text-center space-y-3 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all duration-200">
                  <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
                  <div className="w-16 h-16 rounded-2xl bg-muted mx-auto flex items-center justify-center">
                    {uploading ? <Loader2 size={26} className="animate-spin text-primary" /> : <Package size={28} className="text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="font-medium">{uploading ? 'Mengupload…' : 'Upload Foto Produk'}</p>
                    <p className="text-sm text-muted-foreground">PNG, JPG, WEBP — klik untuk pilih</p>
                  </div>
                </label>
              )}
            </TabsContent>

            {/* Tab Varian */}
            <TabsContent value="varian" className="space-y-4 pt-4">
              <div className="flex items-center justify-between py-2 rounded-lg px-3 bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Produk Punya Varian</p>
                  <p className="text-xs text-muted-foreground">Mis. model/tipe mesin atau ukuran — tiap varian punya harga & stok sendiri</p>
                </div>
                <Switch checked={hasVariants} onCheckedChange={setHasVariantsLocal} />
              </div>

              {hasVariants && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Daftar Varian</Label>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
                      onClick={() => setVariantRows((r) => [...r, { name: '', price: 0, cost_price: 0, stock: 0 }])}>
                      <Wand2 size={13} /> Tambah Varian
                    </Button>
                  </div>
                  {variantRows.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input placeholder="Nama varian (mis. Model A)" className="h-8 flex-1" value={v.name}
                        onChange={(e) => setVariantRows((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                      <Input type="number" placeholder="Harga" className="h-8 w-24" value={v.price || ''}
                        onChange={(e) => setVariantRows((arr) => arr.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) || 0 } : x)))} />
                      <Input type="number" placeholder="Modal" className="h-8 w-24" value={v.cost_price || ''}
                        onChange={(e) => setVariantRows((arr) => arr.map((x, j) => (j === i ? { ...x, cost_price: Number(e.target.value) || 0 } : x)))} />
                      <Input type="number" placeholder="Stok" className="h-8 w-16" value={v.stock || ''}
                        onChange={(e) => setVariantRows((arr) => arr.map((x, j) => (j === i ? { ...x, stock: Number(e.target.value) || 0 } : x)))} />
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                        onClick={() => setVariantRows((arr) => arr.filter((_, j) => j !== i))}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                  {variantRows.length === 0 && <p className="text-xs text-muted-foreground">Belum ada varian. Klik &ldquo;Tambah Varian&rdquo;.</p>}
                  <p className="text-xs text-muted-foreground pt-1">Kolom: Nama · Harga · Modal (HPP) · Stok. Stok per varian dihitung terpisah.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isSubmitting && <Loader2 size={15} className="animate-spin mr-1.5" />}
              {isEdit ? 'Simpan Perubahan' : 'Tambah Produk'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
