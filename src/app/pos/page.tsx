'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Search, Plus, Minus, Trash2, User, Tag, Banknote,
  QrCode, CreditCard, Smartphone, ArrowLeftRight, CheckCircle2,
  ShoppingCart, ChevronRight, Receipt, Lock, PlayCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ShiftModal } from '@/components/pos/shift-modal'
import { CustomerSelector } from '@/components/pos/customer-selector'
import { ReceiptModal } from '@/components/pos/receipt-modal'
import { useProductStore } from '@/stores/use-product-store'
import { useCategoryStore } from '@/stores/use-category-store'
import { useCustomerStore } from '@/stores/use-customer-store'
import { useTransactionStore } from '@/stores/use-transaction-store'
import { useShiftStore } from '@/stores/use-shift-store'
import { formatRupiah, calculateChange, generateId, generateTransactionNumber, cn } from '@/lib/utils'
import type { Product, Customer, PaymentMethod, Transaction, TransactionItem } from '@/types'
import { toast } from 'sonner'

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
  const products = useProductStore((s) => s.products)
  const decrementStock = useProductStore((s) => s.decrementStock)
  const categories = useCategoryStore((s) => s.categories)
  const recordPurchase = useCustomerStore((s) => s.recordPurchase)
  const addTransaction = useTransactionStore((s) => s.addTransaction)
  const currentShift = useShiftStore((s) => s.currentShift)
  const recordSale = useShiftStore((s) => s.recordSale)

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [paidAmount, setPaidAmount] = useState(0)
  const [showPayment, setShowPayment] = useState(false)

  const [shiftOpenModal, setShiftOpenModal] = useState(false)
  const [shiftCloseModal, setShiftCloseModal] = useState(false)
  const [customerSheet, setCustomerSheet] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptTxn, setReceiptTxn] = useState<Transaction | null>(null)

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.is_active) return false
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
      const matchCat = selectedCategory === 'all' || p.category_id === selectedCategory
      return matchSearch && matchCat
    })
  }, [products, search, selectedCategory])

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const discountAmount = discount
  const total = Math.max(0, subtotal - discountAmount)
  const change = calculateChange(total, paidAmount)

  const addToCart = useCallback((product: Product) => {
    if (product.stock === 0) { toast.error('Stok produk habis!'); return }
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id)
      if (existing) {
        if (existing.quantity >= product.stock) { toast.error(`Stok ${product.name} hanya ${product.stock}`); return prev }
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

  const handlePaymentOpen = () => {
    if (cart.length === 0) { toast.error('Keranjang masih kosong!'); return }
    if (paymentMethod === 'cash' && paidAmount === 0) setPaidAmount(total)
    setShowPayment(true)
  }

  const handleConfirm = () => {
    if (!currentShift) { toast.error('Shift belum dibuka'); return }
    if (cart.length === 0) return
    if (paymentMethod === 'cash' && paidAmount < total) {
      toast.error('Jumlah bayar kurang dari total')
      return
    }

    const now = new Date().toISOString()
    const txnId = generateId('trx')
    const items: TransactionItem[] = cart.map((c) => ({
      id: generateId('item'),
      transaction_id: txnId,
      product_id: c.product_id,
      product_name: c.product_name,
      product_price: c.price,
      quantity: c.quantity,
      discount: c.discount,
      subtotal: c.subtotal,
    }))
    const emp = currentShift.employee
    const txn: Transaction = {
      id: txnId,
      outlet_id: 'outlet-1',
      transaction_number: generateTransactionNumber(),
      customer_id: selectedCustomer?.id,
      customer: selectedCustomer ?? undefined,
      cashier_id: emp?.id ?? 'emp-1',
      cashier: emp
        ? { id: emp.id, email: emp.email ?? '', full_name: emp.name, role: emp.role, is_active: emp.is_active, created_at: emp.created_at }
        : undefined,
      items,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: 0,
      service_charge_amount: 0,
      total,
      paid_amount: paymentMethod === 'cash' ? paidAmount : total,
      change_amount: paymentMethod === 'cash' ? change : 0,
      payment_method: paymentMethod,
      status: 'completed',
      created_at: now,
    }

    addTransaction(txn)
    cart.forEach((c) => decrementStock(c.product_id, c.quantity))
    if (selectedCustomer) recordPurchase(selectedCustomer.id, total)
    recordSale(total)

    setShowPayment(false)
    setReceiptTxn(txn)
    setShowReceipt(true)
    clearCart()
  }

  const categoryTabs = [{ id: 'all', name: 'Semua', icon: '🏪' }, ...categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon ?? '📦' }))]

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* ── LEFT: Category Sidebar ── */}
      <div className="w-20 flex flex-col shrink-0 py-3 gap-1 overflow-y-auto"
        style={{ background: 'oklch(0.13 0.03 256)', borderRight: '1px solid oklch(0.22 0.04 256)' }}>
        {categoryTabs.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              'flex flex-col items-center gap-1 py-3 mx-2 rounded-xl text-center transition-all duration-150',
              selectedCategory === cat.id ? 'text-white' : 'opacity-60 hover:opacity-90'
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
                    isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:shadow-md active:scale-95 cursor-pointer'
                  )}>
                  {inCart && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white bg-primary">
                      {inCart.quantity}
                    </div>
                  )}
                  <div className="aspect-square rounded-lg bg-muted flex items-center justify-center mb-2 text-2xl">
                    {product.category?.icon ?? '📦'}
                  </div>
                  <p className="text-xs font-semibold leading-tight line-clamp-2 mb-1 flex-1">{product.name}</p>
                  <p className="text-sm font-bold text-primary">{formatRupiah(product.price)}</p>
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
        {/* Shift bar */}
        <div className="px-4 py-2 flex items-center justify-between border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">{currentShift?.employee?.name ?? 'Tidak ada shift'}</span>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setShiftCloseModal(true)}>
            Tutup Shift
          </Button>
        </div>

        {/* Customer */}
        <div className="p-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setCustomerSheet(true)}
            className="w-full flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/60 hover:bg-muted transition-colors">
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
                        className="w-6 h-6 rounded-md flex items-center justify-center text-white transition-colors bg-primary">
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

          <div className="space-y-1.5">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatRupiah(subtotal)}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-sm text-emerald-600"><span>Diskon</span><span>-{formatRupiah(discountAmount)}</span></div>}
            <Separator />
            <div className="flex justify-between font-bold"><span>Total</span><span className="text-lg">{formatRupiah(total)}</span></div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {PAYMENT_METHODS.map((m) => {
              const Icon = m.icon
              return (
                <button
                  key={m.value}
                  onClick={() => setPaymentMethod(m.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-all duration-150',
                    paymentMethod === m.value ? 'text-white border-transparent bg-primary' : 'hover:border-primary/50 text-muted-foreground'
                  )}>
                  <Icon size={15} />
                  {m.label}
                </button>
              )
            })}
          </div>

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

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="h-10 text-sm" onClick={clearCart} disabled={cart.length === 0}>
              Batal
            </Button>
            <Button size="sm" className="h-10 text-sm font-semibold gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
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
            <div className="rounded-xl p-4 space-y-1 bg-primary/5 border border-primary/20">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Metode Bayar</span><span className="font-semibold capitalize">{paymentMethod === 'cash' ? 'Tunai' : paymentMethod.toUpperCase()}</span></div>
              {paymentMethod === 'cash' && <>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Dibayar</span><span className="font-semibold">{formatRupiah(paidAmount)}</span></div>
                <div className="flex justify-between text-sm text-emerald-600 font-semibold"><span>Kembalian</span><span>{formatRupiah(change)}</span></div>
              </>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowPayment(false)}>Kembali</Button>
            <Button className="flex-1 font-semibold gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleConfirm}>
              <CheckCircle2 size={16} /> Konfirmasi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Shift not open overlay ── */}
      {!currentShift && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <div className="text-center space-y-4 max-w-xs px-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Lock size={28} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Shift Belum Dibuka</h2>
              <p className="text-sm text-muted-foreground">Buka shift kasir dulu untuk mulai bertransaksi.</p>
            </div>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5" onClick={() => setShiftOpenModal(true)}>
              <PlayCircle size={16} /> Buka Shift
            </Button>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <ShiftModal open={shiftOpenModal} onOpenChange={setShiftOpenModal} mode="open" />
      <ShiftModal open={shiftCloseModal} onOpenChange={setShiftCloseModal} mode="close" />
      <CustomerSelector open={customerSheet} onOpenChange={setCustomerSheet} selectedId={selectedCustomer?.id ?? null} onSelect={setSelectedCustomer} />
      <ReceiptModal open={showReceipt} onOpenChange={setShowReceipt} transaction={receiptTxn} />
    </div>
  )
}
