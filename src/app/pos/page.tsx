'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Search, Plus, Minus, Trash2, User, Tag, Banknote,
  QrCode, CheckCircle2,
  ShoppingCart, ChevronRight, Receipt, Lock, PlayCircle, X, Gift, Pause, Clock, Split,
  Landmark, ShoppingBag, Music2, Store, LayoutDashboard
} from 'lucide-react'
import { CategoryIcon } from '@/components/category-icon'
import { OutletSwitcher } from '@/components/dashboard/outlet-switcher'
import { PAYMENT_METHODS as PAYMENT_METHOD_DEFS } from '@/lib/constants'

const MAX_SHOWN = 120 // batas kartu produk yang dirender sekaligus (performa katalog besar)
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ShiftModal } from '@/components/pos/shift-modal'
import { CustomerSelector } from '@/components/pos/customer-selector'
import { ReceiptModal } from '@/components/pos/receipt-modal'
import { useProductStore } from '@/stores/use-product-store'
import { useCategoryStore } from '@/stores/use-category-store'
import { useCustomerStore } from '@/stores/use-customer-store'
import { useTransactionStore } from '@/stores/use-transaction-store'
import { useShiftStore } from '@/stores/use-shift-store'
import { useSettingsStore } from '@/stores/use-settings-store'
import { useStockMovementStore } from '@/stores/use-stock-movement-store'
import { useHeldOrderStore } from '@/stores/use-held-order-store'
import { useVariantStore } from '@/stores/use-variant-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { formatRupiah, calculateChange, generateId, generateTransactionNumber, cn, rankedSearch } from '@/lib/utils'
import type { Product, Customer, PaymentMethod, Transaction, TransactionItem, ProductVariant } from '@/types'
import { toast } from 'sonner'

interface CartItem {
  key: string            // unik per baris: variant_id atau product_id
  product_id: string
  variant_id?: string
  product_name: string
  sku: string
  price: number
  quantity: number
  discount: number
  subtotal: number
  unit: string
  factor: number
  image_url?: string
}

const PAY_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Banknote, Landmark, QrCode, ShoppingBag, Music2, ShoppingCart, Store,
}
const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ComponentType<{ size?: number }> }[] =
  PAYMENT_METHOD_DEFS.map((m) => ({ value: m.value as PaymentMethod, label: m.label, icon: PAY_ICONS[m.icon] ?? Banknote }))

const QUICK_AMOUNTS = [50000, 100000, 200000, 500000]

/** Harga per unit untuk satuan & qty tertentu. Satuan dasar ikut harga grosir bertingkat. */
function linePriceFor(product: Product, unitName: string, qty: number): number {
  if (unitName !== product.unit) {
    const u = product.units?.find((x) => x.name === unitName)
    return u ? u.price : product.price
  }
  const tiers = (product.price_tiers ?? []).filter((t) => t.min_qty > 0).slice().sort((a, b) => b.min_qty - a.min_qty)
  const t = tiers.find((tt) => qty >= tt.min_qty)
  return t ? t.price : product.price
}

export default function POSPage() {
  const products = useProductStore((s) => s.products)
  const decrementStock = useProductStore((s) => s.decrementStock)
  const activeOutletId = useActiveOutletStore((s) => s.activeOutletId)
  const categories = useCategoryStore((s) => s.categories)
  const recordPurchase = useCustomerStore((s) => s.recordPurchase)
  const addTransaction = useTransactionStore((s) => s.addTransaction)
  const currentShift = useShiftStore((s) => s.currentShift)
  const recordSale = useShiftStore((s) => s.recordSale)
  const redeemPointsAction = useCustomerStore((s) => s.redeemPoints)
  const taxRate = useSettingsStore((s) => s.taxRate)
  const serviceRate = useSettingsStore((s) => s.serviceRate)
  const addMovement = useStockMovementStore((s) => s.addMovement)
  const heldOrders = useHeldOrderStore((s) => s.held)
  const holdOrder = useHeldOrderStore((s) => s.hold)
  const recallOrder = useHeldOrderStore((s) => s.recall)
  const removeHeld = useHeldOrderStore((s) => s.remove)
  const variants = useVariantStore((s) => s.variants)
  const decrementVariantStock = useVariantStore((s) => s.decrementVariantStock)

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [discount, setDiscount] = useState(0)
  const [pointsRedeem, setPointsRedeem] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [splitMethod1, setSplitMethod1] = useState<PaymentMethod>('cash')
  const [splitMethod2, setSplitMethod2] = useState<PaymentMethod>('qris')
  const [splitAmount1, setSplitAmount1] = useState(0)
  const [paidAmount, setPaidAmount] = useState(0)
  const [showPayment, setShowPayment] = useState(false)

  const [shiftOpenModal, setShiftOpenModal] = useState(false)
  const [shiftCloseModal, setShiftCloseModal] = useState(false)
  const [customerSheet, setCustomerSheet] = useState(false)
  const [showHeld, setShowHeld] = useState(false)
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptTxn, setReceiptTxn] = useState<Transaction | null>(null)

  const filteredProducts = useMemo(() => {
    const base = products.filter((p) => p.is_active && (selectedCategory === 'all' || p.category_id === selectedCategory))
    return rankedSearch(base, search, (p) => [p.name, p.sku, p.barcode], (p) => p.name)
  }, [products, search, selectedCategory])

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const promoDiscount = 0
  const maxRedeem = Math.max(0, Math.min(selectedCustomer?.points ?? 0, subtotal - discount - promoDiscount))
  const pointsUsed = Math.max(0, Math.min(pointsRedeem, maxRedeem))
  const discountAmount = discount + promoDiscount + pointsUsed
  const base = Math.max(0, subtotal - discountAmount)
  const taxAmount = Math.round(base * (taxRate / 100))
  const serviceAmount = Math.round(base * (serviceRate / 100))
  const total = base + taxAmount + serviceAmount
  const change = calculateChange(total, paidAmount)

  const productVariants = (productId: string) => variants.filter((v) => v.product_id === productId)

  const handleProductClick = (product: Product) => {
    if (product.has_variants && productVariants(product.id).length > 0) {
      setPickerProduct(product)
      return
    }
    addToCart(product)
  }

  const addToCart = useCallback((product: Product) => {
    if (product.stock === 0) { toast.error('Stok produk habis!'); return }
    setCart((prev) => {
      const existing = prev.find((i) => i.key === product.id)
      if (existing) {
        if (existing.quantity * (existing.factor || 1) >= product.stock) { toast.error(`Stok ${product.name} hanya ${product.stock}`); return prev }
        const q = existing.quantity + 1
        const pr = linePriceFor(product, existing.unit, q)
        return prev.map((i) => (i.key === product.id ? { ...i, quantity: q, price: pr, subtotal: Math.max(0, q * pr - i.discount) } : i))
      }
      return [...prev, {
        key: product.id,
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        price: product.price,
        quantity: 1,
        discount: 0,
        subtotal: product.price,
        unit: product.unit,
        factor: 1,
      }]
    })
  }, [])

  const addVariantToCart = (product: Product, variant: ProductVariant) => {
    setPickerProduct(null)
    setCart((prev) => {
      const existing = prev.find((i) => i.key === variant.id)
      if (existing) {
        if (existing.quantity >= variant.stock) { toast.error(`Stok ${variant.name} hanya ${variant.stock}`); return prev }
        const q = existing.quantity + 1
        return prev.map((i) => (i.key === variant.id ? { ...i, quantity: q, subtotal: Math.max(0, q * i.price - i.discount) } : i))
      }
      return [...prev, {
        key: variant.id,
        product_id: product.id,
        variant_id: variant.id,
        product_name: `${product.name} — ${variant.name}`,
        sku: variant.sku ?? product.sku,
        price: variant.price,
        quantity: 1,
        discount: 0,
        subtotal: variant.price,
        unit: product.unit,
        factor: 1,
      }]
    })
  }

  const updateQty = (key: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((i) => {
          if (i.key !== key) return i
          const q = i.quantity + delta
          // Cegah oversell saat menambah qty (hormati faktor satuan & stok varian)
          if (delta > 0) {
            if (i.variant_id) {
              const v = variants.find((x) => x.id === i.variant_id)
              if (v && q > v.stock) { toast.error(`Stok ${i.product_name} hanya ${v.stock}`); return i }
            } else {
              const product = products.find((p) => p.id === i.product_id)
              if (product && q * (i.factor || 1) > product.stock) { toast.error(`Stok ${product.name} hanya ${product.stock}`); return i }
            }
          }
          let pr = i.price
          if (!i.variant_id) {
            const product = products.find((p) => p.id === i.product_id)
            if (product) pr = linePriceFor(product, i.unit, q)
          }
          return { ...i, quantity: q, price: pr, subtotal: Math.max(0, q * pr - i.discount) }
        })
        .filter((i) => i.quantity > 0)
    })
  }

  // Set qty langsung (ketik di keranjang). Minimal 1, dibatasi stok (hormati faktor satuan & varian).
  const setQty = (key: string, raw: number) => {
    setCart((prev) => prev.map((i) => {
      if (i.key !== key) return i
      let q = Math.max(1, Math.floor(Number.isFinite(raw) ? raw : 1))
      if (i.variant_id) {
        const v = variants.find((x) => x.id === i.variant_id)
        if (v && q > v.stock) { toast.error(`Stok ${i.product_name} hanya ${v.stock}`); q = Math.max(1, v.stock) }
      } else {
        const product = products.find((p) => p.id === i.product_id)
        if (product && q * (i.factor || 1) > product.stock) {
          const maxQ = Math.max(1, Math.floor(product.stock / (i.factor || 1)))
          toast.error(`Stok ${product.name} hanya ${product.stock}`); q = maxQ
        }
      }
      let pr = i.price
      if (!i.variant_id) {
        const product = products.find((p) => p.id === i.product_id)
        if (product) pr = linePriceFor(product, i.unit, q)
      }
      return { ...i, quantity: q, price: pr, subtotal: Math.max(0, q * pr - i.discount) }
    }))
  }

  const removeFromCart = (key: string) => {
    setCart((prev) => prev.filter((i) => i.key !== key))
  }

  const setItemDiscount = (key: string, value: number) => {
    setCart((prev) => prev.map((i) => {
      if (i.key !== key) return i
      const max = i.price * i.quantity
      const d = Math.max(0, Math.min(Number.isFinite(value) ? value : 0, max))
      return { ...i, discount: d, subtotal: max - d }
    }))
  }

  const setItemUnit = (key: string, unitName: string) => {
    setCart((prev) => prev.map((i) => {
      if (i.key !== key) return i
      if (i.variant_id) return i // varian tidak punya multi-satuan
      const product = products.find((p) => p.id === i.product_id)
      if (!product) return i
      const factor = unitName === product.unit ? 1 : (product.units?.find((x) => x.name === unitName)?.factor ?? 1)
      const price = linePriceFor(product, unitName, i.quantity)
      return { ...i, unit: unitName, factor, price, discount: 0, subtotal: i.quantity * price }
    }))
  }

  const clearCart = () => {
    setCart([])
    setDiscount(0)
    setPointsRedeem(0)
    setSplitAmount1(0)
    setPaidAmount(0)
    setSelectedCustomer(null)
  }

  const handleHold = () => {
    if (cart.length === 0) return
    holdOrder({
      label: selectedCustomer?.name ?? `Pesanan ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
      cart,
      customer: selectedCustomer,
      discount,
      pointsRedeem,
      itemCount: cart.reduce((s, i) => s + i.quantity, 0),
      total,
    })
    toast.success('Pesanan ditahan')
    clearCart()
  }

  const handleRecall = (id: string) => {
    const order = recallOrder(id)
    if (!order) return
    setCart(order.cart)
    setSelectedCustomer(order.customer)
    setDiscount(order.discount)
    setPointsRedeem(order.pointsRedeem)
    setShowHeld(false)
    toast.success('Pesanan dipulihkan')
  }

  // Guard anti double-submit: cegah klik "Konfirmasi" dua kali (transaksi & potong stok ganda).
  const submittingRef = useRef(false)

  const handlePaymentOpen = () => {
    if (cart.length === 0) { toast.error('Keranjang masih kosong!'); return }
    if (paymentMethod === 'cash' && paidAmount === 0) setPaidAmount(total)
    submittingRef.current = false // mulai alur bayar baru
    setShowPayment(true)
  }

  const handleConfirm = () => {
    if (submittingRef.current) return // sudah diproses — abaikan klik berulang
    if (!currentShift) { toast.error('Shift belum dibuka'); return }
    if (cart.length === 0) return
    if (paymentMethod === 'cash' && paidAmount < total) {
      toast.error('Jumlah bayar kurang dari total')
      return
    }
    if (paymentMethod === 'split' && splitMethod1 === splitMethod2) {
      toast.error('Pilih 2 metode berbeda untuk split')
      return
    }
    const splitAmt1 = Math.min(splitAmount1, total)
    const splitDetails = paymentMethod === 'split'
      ? { [splitMethod1]: splitAmt1, [splitMethod2]: total - splitAmt1 }
      : undefined

    const now = new Date().toISOString()
    const txnId = generateId('trx')
    const items: TransactionItem[] = cart.map((c) => ({
      id: generateId('item'),
      transaction_id: txnId,
      product_id: c.product_id,
      product_name: c.factor !== 1 ? `${c.product_name} (${c.unit})` : c.product_name,
      product_price: c.price,
      quantity: c.quantity,
      discount: c.discount,
      subtotal: c.subtotal,
    }))
    const emp = currentShift.employee
    const txn: Transaction = {
      id: txnId,
      outlet_id: useActiveOutletStore.getState().activeOutletId,
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
      tax_amount: taxAmount,
      service_charge_amount: serviceAmount,
      total,
      paid_amount: paymentMethod === 'cash' ? paidAmount : total,
      change_amount: paymentMethod === 'cash' ? change : 0,
      payment_details: splitDetails,
      payment_method: paymentMethod,
      status: 'completed',
      created_at: now,
    }

    submittingRef.current = true // kunci: mulai sini transaksi diproses
    addTransaction(txn)
    cart.forEach((c) => {
      if (c.variant_id) {
        // before/after dari inventory NYATA (cabang aktif) — bukan stok proyeksi yang bisa basi.
        const { before, after } = decrementVariantStock(c.variant_id, c.quantity)
        addMovement({
          product_id: c.product_id,
          type: 'out',
          quantity: -c.quantity,
          before_stock: before,
          after_stock: after,
          notes: `Penjualan POS (${c.product_name})`,
          reference_id: txnId,
          created_by_name: emp?.name,
          outlet_id: activeOutletId,
        })
        return
      }
      const qtyBase = c.quantity * c.factor
      const { before, after } = decrementStock(c.product_id, qtyBase)
      addMovement({
        product_id: c.product_id,
        type: 'out',
        quantity: -qtyBase,
        before_stock: before,
        after_stock: after,
        notes: 'Penjualan POS',
        reference_id: txnId,
        created_by_name: emp?.name,
        outlet_id: activeOutletId,
      })
    })
    if (selectedCustomer) recordPurchase(selectedCustomer.id, total)
    if (selectedCustomer && pointsUsed > 0) redeemPointsAction(selectedCustomer.id, pointsUsed)
    recordSale(total)

    setShowPayment(false)
    setReceiptTxn(txn)
    setShowReceipt(true)
    clearCart()
  }

  const categoryTabs = [{ id: 'all', name: 'Semua', icon: 'Store' }, ...categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon ?? 'Package' }))]

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
            <CategoryIcon name={cat.icon} size={20} />
            <span className="text-xs font-medium leading-none w-full truncate text-center px-0.5" title={cat.name} style={{ color: selectedCategory === cat.id ? 'white' : 'oklch(0.7 0.02 250)' }}>
              {cat.name.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>

      {/* ── MIDDLE: Product Grid ── */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-muted/30">
        <div className="p-3 shrink-0 flex items-center gap-2 flex-wrap">
          <OutletSwitcher className="bg-background h-10" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-w-[160px]">
            <option value="all">Semua Kategori</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, SKU, atau barcode..."
              className="pl-9 h-10 bg-background"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 px-3 pb-3">
          <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.slice(0, MAX_SHOWN).map((product) => {
              const vlist = product.has_variants ? productVariants(product.id) : []
              const hasVar = vlist.length > 0
              const effectiveStock = hasVar ? vlist.reduce((s, v) => s + v.stock, 0) : product.stock
              const isOutOfStock = effectiveStock === 0
              const inCartQty = cart.filter((i) => i.product_id === product.id).reduce((s, i) => s + i.quantity, 0)
              const minVarPrice = hasVar ? Math.min(...vlist.map((v) => v.price)) : product.price
              return (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  disabled={isOutOfStock}
                  className={cn(
                    'relative flex flex-col bg-card rounded-xl border p-3 text-left transition-all duration-150 overflow-hidden',
                    isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:shadow-md active:scale-95 cursor-pointer'
                  )}>
                  {inCartQty > 0 && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white bg-primary">
                      {inCartQty}
                    </div>
                  )}
                  {hasVar && (
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-100 text-violet-700">VARIAN</div>
                  )}
                  <div className="aspect-square rounded-lg bg-muted flex items-center justify-center mb-2 overflow-hidden text-muted-foreground">
                    {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <CategoryIcon name={product.category?.icon} size={28} />}
                  </div>
                  <p className="text-xs font-semibold leading-tight line-clamp-2 mb-1 flex-1">{product.name}</p>
                  <p className="text-sm font-bold text-primary">{hasVar ? `dari ${formatRupiah(minVarPrice)}` : formatRupiah(product.price)}</p>
                  <p className="text-xs text-muted-foreground">{hasVar ? `${vlist.length} varian` : `Stok: ${product.stock}`}</p>
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
          {filteredProducts.length > MAX_SHOWN && (
            <p className="text-center text-xs text-muted-foreground py-3">
              Menampilkan {MAX_SHOWN} dari {filteredProducts.length} produk — persempit dengan pencarian atau kategori.
            </p>
          )}
        </ScrollArea>
      </div>

      {/* ── RIGHT: Cart ── */}
      <div className="w-96 flex flex-col shrink-0 min-h-0 overflow-hidden bg-card border-l">
        {/* Shift bar */}
        <div className="px-4 py-2 flex items-center justify-between border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">{currentShift?.employee?.name ?? 'Tidak ada shift'}</span>
          </div>
          <div className="flex items-center gap-1">
            {heldOrders.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowHeld(true)}>
                <Clock size={12} /> Tertahan ({heldOrders.length})
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setShiftCloseModal(true)}>
              Tutup Shift
            </Button>
          </div>
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

        {/* Keranjang + Ringkasan & Pembayaran — scroll bersama, tombol Bayar dipatok di bawah */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 py-3">
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
              {cart.map((item) => {
                const prod = products.find((p) => p.id === item.product_id)
                return (
                <div key={item.key} className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground"><CategoryIcon name={prod?.category?.icon} size={15} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">{formatRupiah(item.price)} / {item.unit}</p>
                    {!item.variant_id && prod && prod.units && prod.units.length > 0 && (
                      <select
                        value={item.unit}
                        onChange={(e) => setItemUnit(item.key, e.target.value)}
                        className="mt-1 h-6 rounded border border-input bg-background px-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                        <option value={prod.unit}>{prod.unit} (dasar)</option>
                        {prod.units.map((u) => <option key={u.name} value={u.name}>{u.name} (isi {u.factor})</option>)}
                      </select>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <button onClick={() => updateQty(item.key, -1)}
                        className="w-6 h-6 rounded-md border flex items-center justify-center hover:bg-muted transition-colors">
                        <Minus size={11} />
                      </button>
                      <input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={item.quantity}
                        onChange={(e) => setQty(item.key, Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-12 h-6 text-sm font-bold text-center rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />

                      <button onClick={() => updateQty(item.key, 1)}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-white transition-colors bg-primary">
                        <Plus size={11} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Disc Rp</span>
                      <input
                        type="number"
                        value={item.discount || ''}
                        placeholder="0"
                        onChange={(e) => setItemDiscount(item.key, Number(e.target.value))}
                        className="w-20 h-6 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{formatRupiah(item.subtotal)}</p>
                    <button onClick={() => removeFromCart(item.key)}
                      className="mt-1 p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                )
              })}
            </div>
          )}
          </div>

          {/* Ringkasan & Pembayaran */}
          <div className="p-4 space-y-4" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="space-y-2">
            {selectedCustomer && selectedCustomer.points > 0 && (
              <div className="flex items-center gap-2">
                <Gift size={14} className="text-muted-foreground" />
                <Input
                  type="number"
                  placeholder={`Tukar poin (maks ${maxRedeem})`}
                  className="h-8 text-sm flex-1"
                  value={pointsRedeem || ''}
                  onChange={(e) => setPointsRedeem(Math.max(0, Math.min(Number(e.target.value) || 0, maxRedeem)))}
                />
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setPointsRedeem(maxRedeem)}>Maks</Button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatRupiah(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-sm text-emerald-600"><span>Diskon manual</span><span>-{formatRupiah(discount)}</span></div>}
            {pointsUsed > 0 && <div className="flex justify-between text-sm text-emerald-600"><span>Tukar poin ({pointsUsed})</span><span>-{formatRupiah(pointsUsed)}</span></div>}
            {taxAmount > 0 && <div className="flex justify-between text-sm text-muted-foreground"><span>PPN ({taxRate}%)</span><span>+{formatRupiah(taxAmount)}</span></div>}
            {serviceAmount > 0 && <div className="flex justify-between text-sm text-muted-foreground"><span>Service ({serviceRate}%)</span><span>+{formatRupiah(serviceAmount)}</span></div>}
            <Separator />
            <div className="flex justify-between font-bold"><span>Total</span><span className="text-lg">{formatRupiah(total)}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
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

          <button
            type="button"
            onClick={() => setPaymentMethod('split')}
            className={cn(
              'w-full py-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all duration-150',
              paymentMethod === 'split' ? 'text-white border-transparent bg-primary' : 'hover:border-primary/50 text-muted-foreground'
            )}>
            <Split size={14} /> Bayar Split (2 metode)
          </button>

          {paymentMethod === 'cash' && (
            <div className="space-y-2">
              <Input
                type="number"
                placeholder="Jumlah bayar"
                className="h-9"
                value={paidAmount || ''}
                onChange={(e) => setPaidAmount(Math.max(0, Number(e.target.value) || 0))}
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
              {paidAmount > 0 && (paidAmount < total ? (
                <div className="flex justify-between text-sm font-semibold text-destructive">
                  <span>Kurang</span><span>{formatRupiah(total - paidAmount)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-sm font-semibold text-emerald-600">
                  <span>Kembalian</span><span>{formatRupiah(change)}</span>
                </div>
              ))}
            </div>
          )}

          {paymentMethod === 'split' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Select value={splitMethod1} onValueChange={(v) => { if (v) setSplitMethod1(v as PaymentMethod) }}>
                  <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" placeholder="0" className="h-9 w-32"
                  value={splitAmount1 || ''}
                  onChange={(e) => setSplitAmount1(Math.max(0, Math.min(Number(e.target.value) || 0, total)))} />
              </div>
              <div className="flex items-center gap-2">
                <Select value={splitMethod2} onValueChange={(v) => { if (v) setSplitMethod2(v as PaymentMethod) }}>
                  <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" readOnly className="h-9 w-32 bg-muted" value={Math.max(0, total - Math.min(splitAmount1, total))} />
              </div>
              <p className="text-xs text-muted-foreground">Metode kedua otomatis menutup sisa tagihan.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="h-10 text-sm" onClick={clearCart} disabled={cart.length === 0}>
              Batal
            </Button>
            <Button variant="outline" size="sm" className="h-10 text-sm gap-1.5" onClick={handleHold} disabled={cart.length === 0}>
              <Pause size={14} /> Tahan
            </Button>
          </div>
          </div>
        </ScrollArea>

        {/* Tombol Bayar dipatok di bawah — selalu terlihat walau panel di-scroll */}
        <div className="p-4 shrink-0 bg-card" style={{ borderTop: '1px solid var(--border)' }}>
          <Button size="sm" className="w-full h-11 text-sm font-semibold gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={handlePaymentOpen}
            disabled={cart.length === 0}>
            <Receipt size={15} /> Bayar
          </Button>
        </div>
      </div>

      {/* ── Payment Confirm Dialog ── */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt size={18} /> Konfirmasi Pembayaran
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ScrollArea className="max-h-[35vh]">
              <div className="space-y-2 pr-2">
                {cart.map((item) => (
                  <div key={item.key} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.product_name} × {item.quantity}</span>
                    <span className="font-medium">{formatRupiah(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Separator />
            <div className="space-y-1">
              {discountAmount > 0 && <div className="flex justify-between text-sm text-emerald-600"><span>Total Diskon</span><span>-{formatRupiah(discountAmount)}</span></div>}
              {taxAmount > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">PPN ({taxRate}%)</span><span>+{formatRupiah(taxAmount)}</span></div>}
              {serviceAmount > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Service ({serviceRate}%)</span><span>+{formatRupiah(serviceAmount)}</span></div>}
              <div className="flex justify-between font-bold text-lg"><span>TOTAL</span><span>{formatRupiah(total)}</span></div>
            </div>
            <div className="rounded-xl p-4 space-y-1 bg-primary/5 border border-primary/20">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Metode Bayar</span><span className="font-semibold capitalize">{paymentMethod === 'cash' ? 'Tunai' : paymentMethod.toUpperCase()}</span></div>
              {paymentMethod === 'cash' && <>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Dibayar</span><span className="font-semibold">{formatRupiah(paidAmount)}</span></div>
                {paidAmount < total ? (
                  <div className="flex justify-between text-sm text-destructive font-semibold"><span>Kurang</span><span>{formatRupiah(total - paidAmount)}</span></div>
                ) : (
                  <div className="flex justify-between text-sm text-emerald-600 font-semibold"><span>Kembalian</span><span>{formatRupiah(change)}</span></div>
                )}
              </>}
              {paymentMethod === 'split' && <>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">{PAYMENT_METHODS.find((m) => m.value === splitMethod1)?.label ?? splitMethod1}</span><span className="font-semibold">{formatRupiah(Math.min(splitAmount1, total))}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">{PAYMENT_METHODS.find((m) => m.value === splitMethod2)?.label ?? splitMethod2}</span><span className="font-semibold">{formatRupiah(total - Math.min(splitAmount1, total))}</span></div>
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

      <Dialog open={!!pickerProduct} onOpenChange={(o) => { if (!o) setPickerProduct(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Tag size={18} /> Pilih Varian — {pickerProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {pickerProduct && productVariants(pickerProduct.id).map((v) => (
              <button key={v.id} disabled={v.stock === 0}
                onClick={() => addVariantToCart(pickerProduct, v)}
                className={cn('w-full flex items-center justify-between gap-2 p-3 rounded-lg border text-left transition-colors', v.stock === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5')}>
                <div>
                  <p className="text-sm font-medium">{v.name}</p>
                  <p className="text-xs text-muted-foreground">Stok: {v.stock}</p>
                </div>
                <span className="text-sm font-bold text-primary">{formatRupiah(v.price)}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={showHeld} onOpenChange={setShowHeld}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader className="pb-4"><SheetTitle>Pesanan Tertahan</SheetTitle></SheetHeader>
          <div className="space-y-2">
            {heldOrders.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Tidak ada pesanan tertahan</p>
            )}
            {heldOrders.map((h) => (
              <div key={h.id} className="rounded-lg border p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{h.label}</p>
                  <p className="text-xs text-muted-foreground">{h.itemCount} item · {formatRupiah(h.total)}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" className="h-8 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => handleRecall(h.id)}>Buka</Button>
                  <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={() => removeHeld(h.id)}><Trash2 size={14} /></Button>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
