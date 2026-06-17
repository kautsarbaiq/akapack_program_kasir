'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ShoppingCart, Store, Plus, Minus, Trash2, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DataBootstrap } from '@/components/data-bootstrap'
import { useStoreCart } from '@/stores/use-store-cart'
import { useSettingsStore } from '@/stores/use-settings-store'
import { formatRupiah } from '@/lib/utils'

export default function TokoLayout({ children }: { children: React.ReactNode }) {
  const items = useStoreCart((s) => s.items)
  const updateQty = useStoreCart((s) => s.updateQty)
  const remove = useStoreCart((s) => s.remove)
  const storeName = useSettingsStore((s) => s.storeName)
  const [cartOpen, setCartOpen] = useState(false)
  const router = useRouter()

  const count = items.reduce((s, i) => s + i.quantity, 0)
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)

  return (
    <div className="min-h-screen bg-muted/20">
      <DataBootstrap />
      <header className="sticky top-0 z-30 bg-background border-b">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/toko" className="flex items-center gap-2 font-bold">
            <Store size={18} className="text-primary" /> {storeName || 'AKAPACK'}
          </Link>
          <Button variant="outline" size="sm" className="gap-1.5 relative" onClick={() => setCartOpen(true)}>
            <ShoppingCart size={16} /> Keranjang
            {count > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">{count}</span>
            )}
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent className="flex flex-col p-0 w-full sm:max-w-md">
          <SheetHeader className="p-4 border-b"><SheetTitle>Keranjang ({count})</SheetTitle></SheetHeader>
          <ScrollArea className="flex-1 p-4">
            {items.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-12">Keranjang masih kosong</p>
            ) : (
              <div className="space-y-3">
                {items.map((i) => (
                  <div key={i.key} className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground"><Package size={18} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{i.name}</p>
                      <p className="text-xs text-muted-foreground">{formatRupiah(i.price)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <button onClick={() => updateQty(i.key, i.quantity - 1)} className="w-6 h-6 rounded-md border flex items-center justify-center hover:bg-muted"><Minus size={11} /></button>
                        <span className="text-sm font-bold w-6 text-center">{i.quantity}</span>
                        <button onClick={() => updateQty(i.key, i.quantity + 1)} className="w-6 h-6 rounded-md bg-primary text-white flex items-center justify-center"><Plus size={11} /></button>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{formatRupiah(i.price * i.quantity)}</p>
                      <button onClick={() => remove(i.key)} className="mt-1 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          {items.length > 0 && (
            <div className="border-t p-4 space-y-3">
              <div className="flex justify-between font-bold"><span>Total</span><span>{formatRupiah(total)}</span></div>
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => { setCartOpen(false); router.push('/toko/checkout') }}>
                Lanjut ke Checkout
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
