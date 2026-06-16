'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Package, Wand2 } from 'lucide-react'
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
import { generateSKU, formatRupiah } from '@/lib/utils'
import { productSchema, type ProductFormValues } from '@/lib/validations'
import type { Product } from '@/types'

const UNITS = ['pcs', 'buah', 'unit', 'kg', 'gram', 'liter', 'ml', 'lusin', 'karton', 'box', 'pack', 'roll', 'meter', 'lembar']

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
  const margin = price > 0 ? Math.round(((price - costPrice) / price) * 100) : 0

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
    }
  }, [open, product, reset])

  const onSubmit = async (data: ProductFormValues) => {
    await new Promise((r) => setTimeout(r, 400))
    if (isEdit && product) {
      updateProduct(product.id, data)
      toast.success(`Produk "${data.name}" berhasil diperbarui`)
    } else {
      addProduct(data)
      toast.success(`Produk "${data.name}" berhasil ditambahkan`)
    }
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
            </TabsContent>

            {/* Tab Foto */}
            <TabsContent value="foto" className="pt-4">
              <div
                className="border-2 border-dashed rounded-2xl p-12 text-center space-y-3 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all duration-200"
                onClick={() => toast.info('Fitur upload foto akan tersedia setelah integrasi Supabase Storage')}
              >
                <div className="w-16 h-16 rounded-2xl bg-muted mx-auto flex items-center justify-center">
                  <Package size={28} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Upload Foto Produk</p>
                  <p className="text-sm text-muted-foreground">PNG, JPG, WEBP — maks. 5MB</p>
                  <p className="text-xs text-muted-foreground mt-1">Klik untuk pilih foto atau drag & drop</p>
                </div>
                <Button type="button" variant="outline" size="sm">Pilih Foto</Button>
              </div>
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
