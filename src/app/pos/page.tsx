'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Search, Plus, Minus, Trash2, User, Tag, Banknote,
  QrCode, CreditCard, Smartphone, ArrowLeftRight, CheckCircle2,
  ShoppingCart, X, ChevronRight, Receipt
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { mockProducts, mockCategories, mockCustomers } from '@/lib/mock-data'
import { formatRupiah, calculateChange } from '@/lib/utils'
import type { Product, Customer, PaymentMethod } from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CartItem {
  product_id: string
  product_name: string
  sku: string
  price: number
  quantity: number
  discount: number
  subtotal: number
  image_url?: string
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { value: 'cash', label: 'Tunai', icon: Banknote },
  { value: 'qris', label: 'QRIS', icon: QrCode },
  { value: 'debit', label: 'Debit', icon: CreditCard },
  { value: 'credit', label: 'Kredit', icon: CreditCard },
  { value: 'transfer', label: 'Transfer', icon: ArrowLeftRight },
  { value: 'ewallet', label: 'E-Wallet', icon: Smartphone },
]

const QUICK_AMOUNTS = [50000, 100000, 200000, 500000]

export default function POSPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [paidAmount, setPaidAmount] = useState(0)
  const [showPayment, setShowPayment] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const filteredProducts = useMemo(() => {
    return mockProducts.filter((p) => {
      if (!p.is_active) return false
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
      const matchCat = selectedCategory === 'all' || p.category_id === selectedCategory
      return matchSearch && matchCat
    })
  }, [search, selectedCategory])

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const discountAmount = discount
  const total = Math.max(0, subtotal - discountAmount)
  const change = calculateChange(total, paidAmount)

  const addToCart = useCallback((product: Product) => {
    if (product.stock === 0) { toast.error('Stok produk habis!'); return }
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.price }
            : i
        )
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        price: product.price,
        quantity: 1,
        discount: 0,
        subtotal: product.price,
      }]
    })
  }, [])

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((i) => i.product_id === productId
          ? { ...i, quantity: i.quantity + delta, subtotal: (i.quantity + delta) * i.price }
          : i
        )
        .filter((i) => i.quantity > 0)
    })
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product_id !== productId))
  }

  const clearCart = () => {
    setCart([])
    setDiscount(0)
    setPaidAmount(0)
    setSelectedCustomer(null)
  }

  const handleConfirm = () => {
    setShowPayment(false)
    setShowSuccess(true)
    setTimeout(() => {
      setShowSuccess(false)
      clearCart()
      toast.success('Transaksi berhasil! Struk telah digenerate.')
    }, 2000)
  }

  const handlePaymentOpen = () => {
    if (cart.length === 0) { toast.error('Keranjang masih kosong!'); return }
    if (paymentMethod === 'cash' && paidAmount === 0) setPaidAmount(total)
    setShowPayment(true)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── LEFT: Category Sidebar ── */}
      <div className="w-20 flex flex-col shrink-0 py-3 gap-1 overflow-y-auto"
        style={{ background: 'oklch(0.13 0.03 256)', borderRight: '1px solid oklch(0.22 0.04 256)' }}>
        {[{ id: 'all', name: 'Semua', icon: '🏪' }, ...mockCategories.map(c => ({
          id: c.id, name: c.name,
          icon: c.name === 'Pakaian' ? '👕' : c.name === 'Elektronik' ? '💻' : c.name === 'Makanan' ? '🍜' : c.name === 'Minuman' ? '☕' : c.name === 'Aksesoris' ? '⌚' : '✏️'
        }))].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              'flex flex-col items-center gap-1 py-3 mx-2 rounded-xl text-center transition-all duration-150',
              selectedCategory === cat.id
                ? 'text-white'
                : 'opacity-60 hover:opacity-90'
            )}
            style={{ background: selectedCategory === cat.id ? 'oklch(0.55 0.22 264)' : undefined }}>
            <span className="text-xl">{cat.icon}</span>
            <span className="text-xs font-medium leading-none" style={{ color: selectedCategory === cat.id ? 'white' : 'oklch(0.7 0.02 250)' }}>
              {cat.name.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>

      {/* ── MIDDLE: Product Grid ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-muted/30">
        {/* Search */}
        <div className="p-3 shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk, scan barcode..."
              className="pl-9 h-10 bg-background"
            />
          </div>
        </div>

        {/* Products */}
        <ScrollArea className="flex-1 px-3 pb-3">
          <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map((product) => {
              const isOutOfStock = product.stock === 0
              const inCart = cart.find((i) => i.product_id === product.id)
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={isOutOfStock}
                  className={cn(
                    'relative flex flex-col bg-card rounded-xl border p-3 text-left transition-all duration-150 overflow-hidden',
                    isOutOfStock
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:border-primary hover:shadow-md active:scale-95 cursor-pointer'
                  )}>
                  {inCart && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: 'oklch(0.55 0.22 264)' }}>
                      {inCart.quantity}
                    </div>
                  )}
                  <div className="aspect-square rounded-lg bg-muted flex items-center justify-center mb-2 text-2xl">
                    {product.category?.name === 'Pakaian' ? '👕' : product.category?.name === 'Elektronik' ? '💻' : product.category?.name === 'Makanan' ? '🍜' : product.category?.name === 'Minuman' ? '☕' : product.category?.name === 'Aksesoris' ? '⌚' : '📦'}
                  </div>
                  <p className="text-xs font-semibold leading-tight line-clamp-2 mb-1 flex-1">{product.name}</p>
                  <p className="text-sm font-bold" style={{ color: 'oklch(0.55 0.22 264)' }}>{formatRupiah(product.price)}</p>
                  <p className="text-xs text-muted-foreground">Stok: {product.stock}</p>
                  {isOutOfStock && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-xl">
                      <span className="text-xs font-bold text-destructive">HABIS</span>
                    </div>
                  )}
                </button>
              )
            })}
            {filteredProducts.length === 0 && (
              <div className="col-span-4 py-20 text-center">
                <p className="text-muted-foreground">Tidak ada produk</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── RIGHT: Cart ── */}
      <div className="w-96 flex flex-col shrink-0 bg-card border-l">
        {/* Customer */}
        <div className="p-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <button className="w-full flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/60 hover:bg-muted transition-colors">
            <User size={15} className="text-muted-foreground" />
            <span className="text-sm flex-1 text-left text-muted-foreground">
              {selectedCustomer ? selectedCustomer.name : 'Pelanggan Umum'}
            </span>
            {selectedCustomer && <Badge variant="secondary" className="text-xs">{selectedCustomer.points} poin</Badge>}
            <ChevronRight size={14} className="text-muted-foreground" />
          </button>
        </div>

        {/* Cart Items */}
        <ScrollArea className="flex-1 px-4 py-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 gap-3">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <ShoppingCart size={24} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Keranjang kosong</p>
              <p className="text-xs text-muted-foreground">Klik produk untuk menambahkan</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.product_id} className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-sm">📦</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">{formatRupiah(item.price)} / pcs</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <button onClick={() => updateQty(item.product_id, -1)}
                        className="w-6 h-6 rounded-md border flex items-center justify-center hover:bg-muted transition-colors">
                        <Minus size={11} />
                      </button>
                      <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product_id, 1)}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-white transition-colors"
                        style={{ background: 'oklch(0.55 0.22 264)' }}>
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{formatRupiah(item.subtotal)}</p>
                    <button onClick={() => removeFromCart(item.product_id)}
                      className="mt-1 p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Summary & Payment */}
        <div className="p-4 space-y-4 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          {/* Discount */}
          <div className="flex items-center gap-2">
            <Tag size={14} className="text-muted-foreground" />
            <Input
              type="number"
              placeholder="Diskon (Rp)"
              className="h-8 text-sm flex-1"
              value={discount || ''}
              onChange={(e) => setDiscount(Number(e.target.value))}
            />
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatRupiah(subtotal)}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-sm text-emerald-600"><span>Diskon</span><span>-{formatRupiah(discountAmount)}</span></div>}
            <Separator />
            <div className="flex justify-between font-bold"><span>Total</span><span className="text-lg">{formatRupiah(total)}</span></div>
          </div>

          {/* Payment method */}
          <div className="grid grid-cols-3 gap-1.5">
            {PAYMENT_METHODS.map((m) => {
              const Icon = m.icon
              return (
                <button
                  key={m.value}
                  onClick={() => setPaymentMethod(m.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-all duration-150',
                    paymentMethod === m.value
                      ? 'text-white border-transparent'
                      : 'hover:border-primary/50 text-muted-foreground'
                  )}
                  style={{ background: paymentMethod === m.value ? 'oklch(0.55 0.22 264)' : undefined }}>
                  <Icon size={15} />
                  {m.label}
                </button>
              )
            })}
          </div>

          {/* Cash input */}
          {paymentMethod === 'cash' && (
            <div className="space-y-2">
              <Input
                type="number"
                placeholder="Jumlah bayar"
                className="h-9"
                value={paidAmount || ''}
                onChange={(e) => setPaidAmount(Number(e.target.value))}
              />
              <div className="flex gap-1.5">
                {QUICK_AMOUNTS.map((amt) => (
                  <button key={amt} onClick={() => setPaidAmount(amt)}
                    className="flex-1 py-1.5 rounded-lg border text-xs font-medium hover:border-primary hover:text-primary transition-colors">
                    {(amt / 1000).toFixed(0)}rb
                  </button>
                ))}
                <button onClick={() => setPaidAmount(total)}
                  className="flex-1 py-1.5 rounded-lg border text-xs font-medium hover:border-primary hover:text-primary transition-colors">
                  Pas
                </button>
              </div>
              {paidAmount > 0 && <div className="flex justify-between text-sm font-semibold text-emerald-600">
                <span>Kembalian</span><span>{formatRupiah(change)}</span>
              </div>}
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="h-10 text-sm" onClick={clearCart} disabled={cart.length === 0}>
              Batal
            </Button>
            <Button size="sm" className="h-10 text-sm font-semibold gap-1.5"
              style={{ background: 'oklch(0.55 0.18 160)' }}
              onClick={handlePaymentOpen}
              disabled={cart.length === 0}>
              <Receipt size={15} /> Bayar
            </Button>
          </div>
        </div>
      </div>

      {/* ── Payment Confirm Dialog ── */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt size={18} /> Konfirmasi Pembayaran
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ScrollArea className="max-h-48">
              <div className="space-y-2 pr-2">
                {cart.map((item) => (
                  <div key={item.product_id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.product_name} × {item.quantity}</span>
                    <span className="font-medium">{formatRupiah(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Separator />
            <div className="space-y-1">
              {discountAmount > 0 && <div className="flex justify-between text-sm text-emerald-600"><span>Diskon</span><span>-{formatRupiah(discountAmount)}</span></div>}
              <div className="flex justify-between font-bold text-lg"><span>TOTAL</span><span>{formatRupiah(total)}</span></div>
            </div>
            <div className="rounded-xl p-4 space-y-1" style={{ background: 'oklch(0.55 0.22 264 / 0.08)', border: '1px solid oklch(0.55 0.22 264 / 0.2)' }}>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Metode Bayar</span><span className="font-semibold capitalize">{paymentMethod === 'cash' ? 'Tunai' : paymentMethod.toUpperCase()}</span></div>
              {paymentMethod === 'cash' && <>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Dibayar</span><span className="font-semibold">{formatRupiah(paidAmount)}</span></div>
                <div className="flex justify-between text-sm text-emerald-600 font-semibold"><span>Kembalian</span><span>{formatRupiah(change)}</span></div>
              </>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowPayment(false)}>Kembali</Button>
            <Button className="flex-1 font-semibold gap-1.5" onClick={handleConfirm}
              style={{ background: 'oklch(0.55 0.18 160)' }}>
              <CheckCircle2 size={16} /> Konfirmasi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Success Animation ── */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card rounded-2xl p-10 flex flex-col items-center gap-4 shadow-2xl">
            <div className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'oklch(0.65 0.18 160 / 0.15)' }}>
              <CheckCircle2 size={40} style={{ color: 'oklch(0.55 0.18 160)' }} />
            </div>
            <p className="text-xl font-bold">Transaksi Berhasil!</p>
            <p className="text-muted-foreground text-sm">Struk sedang diproses...</p>
          </div>
        </div>
      )}
    </div>
  )
}
