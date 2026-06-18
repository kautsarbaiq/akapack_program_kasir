// ═══════════════════════════════════════
// AKAPACK — TypeScript Types & Interfaces
// ═══════════════════════════════════════

// ─── Auth & User ───────────────────────
export type UserRole = 'owner' | 'manager' | 'cashier'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  avatar_url?: string
  outlet_id?: string
  phone?: string
  is_active: boolean
  created_at: string
}

// ─── Outlet / Toko ─────────────────────
export interface Outlet {
  id: string
  name: string
  address: string
  phone?: string
  email?: string
  logo_url?: string
  tax_rate: number        // persentase PPN (misal: 11)
  service_charge: number  // persentase service charge (misal: 5)
  receipt_header?: string
  receipt_footer?: string
  is_active: boolean
  created_at: string
}

// ─── Kategori Produk ───────────────────
export interface Category {
  id: string
  outlet_id: string
  name: string
  color?: string
  icon?: string
  sort_order: number
  product_count?: number
  is_active: boolean
  created_at: string
}

// ─── Produk ────────────────────────────
export type StockStatus = 'safe' | 'low' | 'out'

/** Satuan tambahan: 1 satuan ini = `factor` satuan dasar, dijual seharga `price` */
export interface ProductUnit {
  name: string
  factor: number
  price: number
}

/** Harga grosir bertingkat: jika beli ≥ min_qty, harga jadi `price` per unit dasar */
export interface PriceTier {
  min_qty: number
  price: number
}

/** Varian produk (mis. model mesin / ukuran) — punya harga & stok sendiri */
export interface ProductVariant {
  id: string
  product_id: string
  name: string
  sku?: string
  barcode?: string
  price: number
  cost_price: number
  stock: number
  is_active: boolean
  created_at: string
}

export interface Product {
  id: string
  outlet_id: string
  category_id: string
  category?: Category
  name: string
  sku: string
  barcode?: string
  description?: string
  image_url?: string
  price: number       // harga jual (toko/POS)
  cost_price: number  // HPP (harga pokok penjualan)
  price_market?: number  // harga pasar/coret (opsional)
  price_online?: number  // harga jual di online store (opsional)
  stock: number       // stok saat ini (dalam satuan dasar)
  min_stock: number   // threshold minimum (untuk alert)
  unit: string        // satuan dasar: pcs, kg, gram, dll
  units?: ProductUnit[]       // satuan tambahan (dus, pak, dll)
  price_tiers?: PriceTier[]   // harga grosir bertingkat
  has_variants?: boolean
  is_active: boolean
  stock_status?: StockStatus
  created_at: string
  updated_at: string
}

// ─── Pelanggan ─────────────────────────
export interface Customer {
  id: string
  outlet_id: string
  name: string
  phone?: string
  email?: string
  address?: string
  points: number
  total_spent: number
  total_transactions: number
  member_since: string
  created_at: string
}

// ─── Cart (POS) ────────────────────────
export interface CartItem {
  product_id: string
  product_name: string
  product_sku: string
  price: number
  cost_price: number
  quantity: number
  discount: number
  discount_type: 'fixed' | 'percentage'
  subtotal: number
  notes: string
  image_url?: string
}

// ─── Transaksi ─────────────────────────
export type PaymentMethod =
  | 'cash'
  | 'qris'
  | 'debit'
  | 'credit'
  | 'transfer'
  | 'ewallet'
  | 'split'

export type TransactionStatus = 'completed' | 'void' | 'refunded' | 'pending'

export interface Transaction {
  id: string
  outlet_id: string
  transaction_number: string
  customer_id?: string
  customer?: Customer
  cashier_id: string
  cashier?: User
  items: TransactionItem[]
  subtotal: number
  discount_amount: number
  tax_amount: number
  service_charge_amount: number
  total: number
  paid_amount: number
  change_amount: number
  payment_method: PaymentMethod
  payment_details?: Record<string, number>
  notes?: string
  source?: 'pos' | 'online'
  shipping_cost?: number
  status: TransactionStatus
  created_at: string
}

export interface TransactionItem {
  id: string
  transaction_id: string
  product_id: string
  variant_id?: string    // jika item adalah varian — untuk restore stok saat batal
  product?: Product
  product_name: string   // snapshot saat transaksi
  product_price: number  // snapshot saat transaksi
  quantity: number
  discount: number
  subtotal: number
  notes?: string
}

// ─── Pergerakan Stok ───────────────────
export type MovementType = 'in' | 'out' | 'adjustment' | 'transfer' | 'opname'

export interface StockMovement {
  id: string
  outlet_id: string
  product_id: string
  product?: Product
  type: MovementType
  quantity: number      // positif = masuk, negatif = keluar
  before_stock: number  // stok sebelum
  after_stock: number   // stok setelah
  notes?: string
  reference_id?: string
  created_by: string
  created_by_name?: string
  created_at: string
}

// ─── Karyawan ──────────────────────────
export interface Employee {
  id: string
  outlet_id: string
  user_id?: string
  name: string
  role: UserRole
  pin?: string
  code?: string        // kode unik untuk absensi (clock-in/out)
  phone?: string
  email?: string
  avatar_url?: string
  is_active: boolean
  created_at: string
}

// ─── Absensi / Kehadiran ───────────────
export interface Attendance {
  id: string
  employee_id: string
  employee?: Employee
  outlet_id?: string
  type: 'in' | 'out'
  timestamp: string    // waktu clock-in/out
  created_at: string
}

// ─── Shift Kasir ───────────────────────
export type ShiftStatus = 'open' | 'closed'

export interface Shift {
  id: string
  outlet_id: string
  employee_id: string
  employee?: Employee
  opening_cash: number
  closing_cash?: number
  total_sales: number
  total_transactions: number
  status: ShiftStatus
  opened_at: string
  closed_at?: string
}

// ─── Promosi ───────────────────────────
export type PromotionType = 'percentage' | 'fixed' | 'bogo' | 'bundle'

export interface Promotion {
  id: string
  outlet_id: string
  name: string
  type: PromotionType
  value: number
  min_purchase?: number
  product_ids?: string[]
  category_ids?: string[]
  code?: string
  max_uses?: number
  used_count: number
  starts_at: string
  ends_at: string
  is_active: boolean
  created_at: string
}

// ─── Akuntansi ─────────────────────────
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

// Akun di Daftar Akun (Chart of Accounts). Saldo normal mengikuti tipe:
// asset & expense = debit; liability, equity, revenue = credit.
export interface Account {
  id: string
  code: string            // kode akun, mis. '1-100'
  name: string            // mis. 'Kas'
  type: AccountType
  opening_balance: number // saldo awal (positif sesuai saldo normal akun)
  is_active: boolean
  description?: string
  created_at: string
}

export type JournalSource = 'manual' | 'pos' | 'online' | 'opening' | 'purchase'

export interface JournalLine {
  account_id: string
  account_code?: string
  account_name?: string
  debit: number
  credit: number
}

export interface JournalEntry {
  id: string
  number: string          // mis. 'JV-20260616-001'
  date: string            // tanggal transaksi (ISO)
  description: string
  source: JournalSource    // 'pos'/'online' = turunan otomatis; 'manual' = input; 'opening' = saldo awal
  reference_id?: string   // id transaksi/sumber terkait
  lines: JournalLine[]    // minimal 2 baris, total debit = total kredit
  created_at: string
}

// Aset tetap untuk penyusutan (garis lurus)
export interface Asset {
  id: string
  name: string
  category: string
  acquired_at: string        // tanggal perolehan (ISO date)
  cost: number               // harga perolehan
  salvage: number            // nilai residu/sisa
  useful_life_months: number // umur manfaat (bulan)
  is_active: boolean
  created_at: string
}

// ─── Pembelian & Supplier ──────────────
export interface Supplier {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
  is_active: boolean
  created_at: string
}

export type PurchaseStatus = 'draft' | 'ordered' | 'received' | 'cancelled'
// credit = tempo (masuk Hutang Usaha); cash/transfer = langsung bayar
export type PurchasePayment = 'cash' | 'transfer' | 'credit'

export interface PurchaseItem {
  id: string
  purchase_id: string
  product_id: string
  product_name: string
  qty: number
  cost: number       // harga beli per unit
  subtotal: number
}

export interface PurchaseOrder {
  id: string
  number: string     // PO-YYYYMMDD-xxx
  supplier_id?: string
  supplier?: Supplier
  items: PurchaseItem[]
  total: number
  status: PurchaseStatus
  payment: PurchasePayment
  paid: boolean      // untuk tempo: sudah dilunasi?
  paid_at?: string   // tanggal pelunasan (untuk jurnal & aging yang benar)
  notes?: string
  received_from?: string // "Diterima dari" — sumber barang (mis. transfer/supplier bebas)
  received_by?: string   // "Diterima Oleh" — email/nama user yang membuat dokumen
  date: string
  received_at?: string
  created_at: string
}

// ─── Stok Keluar (dokumen pengeluaran stok) ──
export type StockOutStatus = 'draft' | 'posted' | 'cancelled'
export type StockOutReason = 'rusak' | 'hilang' | 'pemakaian' | 'retur' | 'penyesuaian' | 'lainnya'

export interface StockOutItem {
  id: string
  stock_out_id: string
  product_id: string
  product_name: string
  qty: number
  cost: number       // nilai modal per unit saat keluar
  subtotal: number
}

export interface StockOut {
  id: string
  number: string     // OUT-YYYYMMDD-xxx
  outlet_id: string
  reason: StockOutReason
  items: StockOutItem[]
  total: number      // total nilai modal
  total_qty: number
  status: StockOutStatus
  notes?: string
  date: string
  posted_at?: string
  created_at: string
}

// ─── Dashboard Stats ───────────────────
export interface DashboardStats {
  today_revenue: number
  today_transactions: number
  today_items_sold: number
  today_new_customers: number
  revenue_change: number       // % vs kemarin
  transactions_change: number
  items_change: number
  customers_change: number
  low_stock_count: number
  out_of_stock_count: number
}

export interface SalesChartData {
  date: string
  revenue: number
  transactions: number
  label?: string
}

export interface TopProduct {
  product_id: string
  product_name: string
  product_sku: string
  image_url?: string
  total_sold: number
  total_revenue: number
  percentage?: number
}

export interface LowStockItem {
  product_id: string
  product_name: string
  sku: string
  current_stock: number
  min_stock: number
  category_name: string
  status: StockStatus
}

// ─── Report Types ─────────────────────
export interface SalesReport {
  total_revenue: number
  total_transactions: number
  avg_transaction_value: number
  total_items_sold: number
  prev_total_revenue: number
  prev_total_transactions: number
  comparison_period: string
}

export interface ProductSalesReport {
  product_id: string
  product_name: string
  sku: string
  quantity_sold: number
  revenue: number
  percentage: number
}

export interface CashierReport {
  cashier_id: string
  cashier_name: string
  total_transactions: number
  total_revenue: number
  avg_per_transaction: number
}

export interface PaymentMethodReport {
  method: PaymentMethod
  label: string
  count: number
  total: number
  percentage: number
}

// ─── API Response Types ────────────────
export interface ApiResponse<T> {
  data: T
  error: string | null
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// ─── Form Types ────────────────────────
// Tipe FormValues kini diturunkan dari schema zod (sumber tunggal):
//   import type { ProductFormValues, CategoryFormValues, ... } from '@/lib/validations'
