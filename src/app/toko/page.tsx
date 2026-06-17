'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { CategoryIcon } from '@/components/category-icon'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useProductStore } from '@/stores/use-product-store'
import { useCategoryStore } from '@/stores/use-category-store'
import { useVariantStore } from '@/stores/use-variant-store'
import { useStoreCart } from '@/stores/use-store-cart'
import { formatRupiah, cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Product } from '@/types'

function onlinePrice(p: Product) {
  return p.price_online && p.price_online > 0 ? p.price_online : p.price
}

export default function TokoCatalog() {
  const products = useProductStore((s) => s.products)
  const categories = useCategoryStore((s) => s.categories)
  const variants = useVariantStore((s) => s.variants)
  const add = useStoreCart((s) => s.add)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('all')

  const list = useMemo(
    () =>
      products.filter(
        (p) =>
          p.is_active &&
          (cat === 'all' || p.category_id === cat) &&
          (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
      ),
    [products, cat, search]
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Belanja Online</h1>
        <p className="text-muted-foreground text-sm">Pesan online, bayar transfer atau COD.</p>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Cari produk..." className="pl-9 bg-background" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setCat('all')} className={cn('px-3 py-1.5 rounded-full text-sm whitespace-nowrap border', cat === 'all' ? 'bg-primary text-white border-transparent' : 'bg-background')}>Semua</button>
        {categories.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)} className={cn('px-3 py-1.5 rounded-full text-sm whitespace-nowrap border', cat === c.id ? 'bg-primary text-white border-transparent' : 'bg-background')}>
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {list.map((p) => {
          const vlist = p.has_variants ? variants.filter((v) => v.product_id === p.id) : []
          const hasVar = vlist.length > 0
          const stock = hasVar ? vlist.reduce((s, v) => s + v.stock, 0) : p.stock
          const out = stock === 0
          const price = hasVar ? Math.min(...vlist.map((v) => v.price)) : onlinePrice(p)
          return (
            <div key={p.id} className="bg-background rounded-xl border overflow-hidden flex flex-col">
              <Link href={`/toko/produk?id=${p.id}`} className="block">
                <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden text-muted-foreground">
                  {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <CategoryIcon name={p.category?.icon} size={40} />}
                </div>
              </Link>
              <div className="p-3 flex flex-col flex-1 gap-1.5">
                <Link href={`/toko/produk?id=${p.id}`} className="text-sm font-medium leading-tight line-clamp-2 hover:text-primary flex-1">{p.name}</Link>
                <p className="text-sm font-bold text-primary">{hasVar ? `dari ${formatRupiah(price)}` : formatRupiah(price)}</p>
                {out ? (
                  <span className="text-xs text-destructive">Stok habis</span>
                ) : hasVar ? (
                  <Link href={`/toko/produk?id=${p.id}`}><Button size="sm" variant="outline" className="w-full h-8 text-xs">Pilih Varian</Button></Link>
                ) : (
                  <Button size="sm" className="w-full h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => { add({ key: p.id, product_id: p.id, name: p.name, price: onlinePrice(p) }); toast.success('Ditambahkan ke keranjang') }}>
                    + Keranjang
                  </Button>
                )}
              </div>
            </div>
          )
        })}
        {list.length === 0 && <p className="col-span-full text-center text-muted-foreground py-12">Tidak ada produk</p>}
      </div>
    </div>
  )
}
