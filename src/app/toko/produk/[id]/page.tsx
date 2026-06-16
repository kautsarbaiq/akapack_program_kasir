'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProductStore } from '@/stores/use-product-store'
import { useVariantStore } from '@/stores/use-variant-store'
import { useStoreCart } from '@/stores/use-store-cart'
import { formatRupiah, cn } from '@/lib/utils'
import { toast } from 'sonner'

export default function ProductDetailPage() {
  const params = useParams()
  const id = String(params.id)
  const router = useRouter()
  const product = useProductStore((s) => s.products.find((p) => p.id === id))
  const variants = useVariantStore((s) => s.variants.filter((v) => v.product_id === id))
  const add = useStoreCart((s) => s.add)
  const [variantId, setVariantId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)

  if (!product) {
    return (
      <div className="py-16 text-center text-muted-foreground space-y-2">
        <p>Produk tidak ditemukan atau sedang dimuat…</p>
        <Link href="/toko" className="text-primary text-sm">← Kembali ke katalog</Link>
      </div>
    )
  }

  const hasVar = product.has_variants && variants.length > 0
  const selectedVar = hasVar ? variants.find((v) => v.id === variantId) : null
  const onlineP = product.price_online && product.price_online > 0 ? product.price_online : product.price
  const price = hasVar ? (selectedVar?.price ?? Math.min(...variants.map((v) => v.price))) : onlineP
  const stock = hasVar ? (selectedVar?.stock ?? variants.reduce((s, v) => s + v.stock, 0)) : product.stock

  const handleAdd = () => {
    if (hasVar && !selectedVar) { toast.error('Pilih varian dulu'); return }
    if (stock === 0) { toast.error('Stok habis'); return }
    if (hasVar && selectedVar) {
      add({ key: selectedVar.id, product_id: product.id, variant_id: selectedVar.id, name: `${product.name} — ${selectedVar.name}`, price: selectedVar.price }, qty)
    } else {
      add({ key: product.id, product_id: product.id, name: product.name, price: onlineP }, qty)
    }
    toast.success('Ditambahkan ke keranjang')
    router.push('/toko')
  }

  return (
    <div className="space-y-5">
      <Link href="/toko" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Kembali</Link>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="aspect-square bg-muted rounded-2xl flex items-center justify-center text-7xl overflow-hidden">
          {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : (product.category?.icon ?? '📦')}
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">{product.category?.name}</p>
            <h1 className="text-2xl font-bold">{product.name}</h1>
          </div>
          <p className="text-2xl font-bold text-primary">{formatRupiah(price)}</p>
          {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}

          {hasVar && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Pilih Varian</p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button key={v.id} disabled={v.stock === 0} onClick={() => setVariantId(v.id)}
                    className={cn('px-3 py-1.5 rounded-lg border text-sm', v.id === variantId ? 'border-primary bg-primary/5 text-primary font-medium' : 'bg-background', v.stock === 0 && 'opacity-40 cursor-not-allowed')}>
                    {v.name}{v.stock === 0 ? ' (habis)' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground">Stok: {stock}</p>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-8 h-8 rounded-md border flex items-center justify-center hover:bg-muted"><Minus size={14} /></button>
              <span className="w-8 text-center font-bold">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center"><Plus size={14} /></button>
            </div>
            <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleAdd} disabled={stock === 0}>
              + Keranjang
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
