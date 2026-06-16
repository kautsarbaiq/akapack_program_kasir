import type {
  Product,
  Category,
  Customer,
  Transaction,
  Employee,
  StockMovement,
  DashboardStats,
  SalesChartData,
  TopProduct,
  LowStockItem,
  Promotion,
  User,
} from '@/types'

// Helper: cast Employee to User shape for cashier field
function toUser(emp: Employee): User {
  return {
    id: emp.id,
    email: emp.email ?? '',
    full_name: emp.name,
    role: emp.role,
    avatar_url: emp.avatar_url,
    outlet_id: emp.outlet_id,
    phone: emp.phone,
    is_active: emp.is_active,
    created_at: emp.created_at,
  }
}

// ─── Categories ───────────────────────
export const mockCategories: Category[] = [
  { id: 'cat-1', outlet_id: 'outlet-1', name: 'Pakaian', color: '#3B82F6', icon: '👕', sort_order: 1, product_count: 12, is_active: true, created_at: '2024-01-01' },
  { id: 'cat-2', outlet_id: 'outlet-1', name: 'Elektronik', color: '#8B5CF6', icon: '💻', sort_order: 2, product_count: 8, is_active: true, created_at: '2024-01-01' },
  { id: 'cat-3', outlet_id: 'outlet-1', name: 'Makanan', color: '#F59E0B', icon: '🍜', sort_order: 3, product_count: 15, is_active: true, created_at: '2024-01-01' },
  { id: 'cat-4', outlet_id: 'outlet-1', name: 'Minuman', color: '#10B981', icon: '☕', sort_order: 4, product_count: 10, is_active: true, created_at: '2024-01-01' },
  { id: 'cat-5', outlet_id: 'outlet-1', name: 'Aksesoris', color: '#EF4444', icon: '⌚', sort_order: 5, product_count: 6, is_active: true, created_at: '2024-01-01' },
  { id: 'cat-6', outlet_id: 'outlet-1', name: 'Alat Tulis', color: '#06B6D4', icon: '✏️', sort_order: 6, product_count: 9, is_active: true, created_at: '2024-01-01' },
]

// ─── Products ─────────────────────────
export const mockProducts: Product[] = [
  {
    id: 'prod-1', outlet_id: 'outlet-1', category_id: 'cat-1',
    category: mockCategories[0],
    name: 'Kaos Polos Premium', sku: 'KAO-001', barcode: '8991234567890',
    description: 'Kaos polos bahan cotton combed 30s premium',
    image_url: undefined, price: 85000, cost_price: 45000,
    stock: 50, min_stock: 10, unit: 'pcs', is_active: true,
    stock_status: 'safe', created_at: '2024-01-15', updated_at: '2024-06-01',
  },
  {
    id: 'prod-2', outlet_id: 'outlet-1', category_id: 'cat-1',
    category: mockCategories[0],
    name: 'Kemeja Flanel Kotak', sku: 'KEM-001', barcode: '8991234567891',
    description: 'Kemeja flanel pria motif kotak slim fit',
    image_url: undefined, price: 195000, cost_price: 95000,
    stock: 8, min_stock: 10, unit: 'pcs', is_active: true,
    stock_status: 'low', created_at: '2024-01-15', updated_at: '2024-06-01',
  },
  {
    id: 'prod-3', outlet_id: 'outlet-1', category_id: 'cat-1',
    category: mockCategories[0],
    name: 'Celana Jeans Slim Fit', sku: 'CEL-001', barcode: '8991234567892',
    description: 'Celana jeans pria slim fit berbagai ukuran',
    image_url: undefined, price: 250000, cost_price: 120000,
    stock: 25, min_stock: 5, unit: 'pcs', is_active: true,
    stock_status: 'safe', created_at: '2024-01-15', updated_at: '2024-06-01',
  },
  {
    id: 'prod-4', outlet_id: 'outlet-1', category_id: 'cat-2',
    category: mockCategories[1],
    name: 'Powerbank 10000mAh', sku: 'PWB-001', barcode: '8991234567893',
    description: 'Powerbank fast charging 22.5W dual port',
    image_url: undefined, price: 150000, cost_price: 85000,
    stock: 0, min_stock: 5, unit: 'unit', is_active: true,
    stock_status: 'out', created_at: '2024-02-01', updated_at: '2024-06-01',
  },
  {
    id: 'prod-5', outlet_id: 'outlet-1', category_id: 'cat-2',
    category: mockCategories[1],
    name: 'Earphone Bluetooth 5.0', sku: 'EAR-001', barcode: '8991234567894',
    description: 'Earphone wireless TWS dengan noise cancelling',
    image_url: undefined, price: 280000, cost_price: 150000,
    stock: 15, min_stock: 5, unit: 'unit', is_active: true,
    stock_status: 'safe', created_at: '2024-02-01', updated_at: '2024-06-01',
  },
  {
    id: 'prod-6', outlet_id: 'outlet-1', category_id: 'cat-3',
    category: mockCategories[2],
    name: 'Snack Keripik Singkong', sku: 'SNK-001', barcode: '8991234567895',
    description: 'Keripik singkong renyah aneka rasa 200gr',
    image_url: undefined, price: 18000, cost_price: 10000,
    stock: 100, min_stock: 20, unit: 'pcs', is_active: true,
    stock_status: 'safe', created_at: '2024-03-01', updated_at: '2024-06-01',
  },
  {
    id: 'prod-7', outlet_id: 'outlet-1', category_id: 'cat-3',
    category: mockCategories[2],
    name: 'Cokelat Premium 100gr', sku: 'COK-001', barcode: '8991234567896',
    description: 'Dark chocolate premium 70% cocoa',
    image_url: undefined, price: 35000, cost_price: 20000,
    stock: 45, min_stock: 10, unit: 'pcs', is_active: true,
    stock_status: 'safe', created_at: '2024-03-01', updated_at: '2024-06-01',
  },
  {
    id: 'prod-8', outlet_id: 'outlet-1', category_id: 'cat-4',
    category: mockCategories[3],
    name: 'Air Mineral 600ml', sku: 'AIR-001', barcode: '8991234567897',
    description: 'Air mineral dalam kemasan botol 600ml',
    image_url: undefined, price: 5000, cost_price: 3000,
    stock: 200, min_stock: 50, unit: 'pcs', is_active: true,
    stock_status: 'safe', created_at: '2024-03-01', updated_at: '2024-06-01',
  },
  {
    id: 'prod-9', outlet_id: 'outlet-1', category_id: 'cat-4',
    category: mockCategories[3],
    name: 'Kopi Sachet Premium', sku: 'KOP-001', barcode: '8991234567898',
    description: 'Kopi sachet 3in1 premium isi 10 sachet',
    image_url: undefined, price: 25000, cost_price: 15000,
    stock: 3, min_stock: 15, unit: 'box', is_active: true,
    stock_status: 'low', created_at: '2024-03-01', updated_at: '2024-06-01',
  },
  {
    id: 'prod-10', outlet_id: 'outlet-1', category_id: 'cat-5',
    category: mockCategories[4],
    name: 'Dompet Kulit Slim', sku: 'DMP-001', barcode: '8991234567899',
    description: 'Dompet kulit asli slim design pria',
    image_url: undefined, price: 175000, cost_price: 85000,
    stock: 12, min_stock: 5, unit: 'pcs', is_active: true,
    stock_status: 'safe', created_at: '2024-04-01', updated_at: '2024-06-01',
  },
  {
    id: 'prod-11', outlet_id: 'outlet-1', category_id: 'cat-5',
    category: mockCategories[4],
    name: 'Jam Tangan Casual', sku: 'JAM-001', barcode: '8991234567900',
    description: 'Jam tangan pria casual water resistant',
    image_url: undefined, price: 350000, cost_price: 180000,
    stock: 7, min_stock: 3, unit: 'pcs', is_active: true,
    stock_status: 'safe', created_at: '2024-04-01', updated_at: '2024-06-01',
  },
  {
    id: 'prod-12', outlet_id: 'outlet-1', category_id: 'cat-6',
    category: mockCategories[5],
    name: 'Pulpen Gel Premium', sku: 'PUL-001', barcode: '8991234567901',
    description: 'Pulpen gel hitam 0.5mm ultra smooth',
    image_url: undefined, price: 8000, cost_price: 4000,
    stock: 150, min_stock: 30, unit: 'pcs', is_active: true,
    stock_status: 'safe', created_at: '2024-05-01', updated_at: '2024-06-01',
  },
]

// ─── Customers ────────────────────────
export const mockCustomers: Customer[] = [
  {
    id: 'cust-1', outlet_id: 'outlet-1', name: 'Budi Santoso',
    phone: '081234567890', email: 'budi@email.com',
    address: 'Jl. Merdeka No. 10, Jakarta',
    points: 2500, total_spent: 4750000, total_transactions: 28,
    member_since: '2024-01-15', created_at: '2024-01-15',
  },
  {
    id: 'cust-2', outlet_id: 'outlet-1', name: 'Sari Dewi',
    phone: '082345678901', email: 'sari@email.com',
    address: 'Jl. Sudirman No. 25, Jakarta',
    points: 1800, total_spent: 3200000, total_transactions: 19,
    member_since: '2024-02-10', created_at: '2024-02-10',
  },
  {
    id: 'cust-3', outlet_id: 'outlet-1', name: 'Ahmad Rizki',
    phone: '083456789012', email: undefined,
    address: 'Jl. Gatot Subroto No. 5, Bandung',
    points: 950, total_spent: 1850000, total_transactions: 12,
    member_since: '2024-03-05', created_at: '2024-03-05',
  },
  {
    id: 'cust-4', outlet_id: 'outlet-1', name: 'Rina Kusuma',
    phone: '084567890123', email: 'rina@email.com',
    address: 'Jl. Asia Afrika No. 12, Bandung',
    points: 3200, total_spent: 6100000, total_transactions: 35,
    member_since: '2024-01-01', created_at: '2024-01-01',
  },
  {
    id: 'cust-5', outlet_id: 'outlet-1', name: 'Doni Pratama',
    phone: '085678901234', email: 'doni@email.com',
    address: 'Jl. Diponegoro No. 8, Surabaya',
    points: 450, total_spent: 875000, total_transactions: 6,
    member_since: '2024-05-20', created_at: '2024-05-20',
  },
]

// ─── Employees ────────────────────────
export const mockEmployees: Employee[] = [
  {
    id: 'emp-1', outlet_id: 'outlet-1', name: 'Andi Wijaya',
    role: 'owner', phone: '081111111111', email: 'andi@akapack.com',
    is_active: true, created_at: '2024-01-01',
  },
  {
    id: 'emp-2', outlet_id: 'outlet-1', name: 'Dewi Sartika',
    role: 'manager', phone: '082222222222', email: 'dewi@akapack.com',
    is_active: true, created_at: '2024-01-15',
  },
  {
    id: 'emp-3', outlet_id: 'outlet-1', name: 'Riko Andrian',
    role: 'cashier', phone: '083333333333', email: undefined,
    pin: '1234', is_active: true, created_at: '2024-02-01',
  },
  {
    id: 'emp-4', outlet_id: 'outlet-1', name: 'Fitri Rahayu',
    role: 'cashier', phone: '084444444444', email: undefined,
    pin: '5678', is_active: true, created_at: '2024-02-15',
  },
  {
    id: 'emp-5', outlet_id: 'outlet-1', name: 'Hendra Gunawan',
    role: 'cashier', phone: '085555555555', email: undefined,
    pin: '9012', is_active: false, created_at: '2024-03-01',
  },
]

// ─── Transactions ─────────────────────
export const mockTransactions: Transaction[] = [
  {
    id: 'trx-1', outlet_id: 'outlet-1',
    transaction_number: 'TRX-20240611-0001',
    customer_id: 'cust-1', customer: mockCustomers[0],
    cashier_id: 'emp-3', cashier: toUser(mockEmployees[2]),
    items: [
      { id: 'item-1', transaction_id: 'trx-1', product_id: 'prod-1', product_name: 'Kaos Polos Premium', product_price: 85000, quantity: 2, discount: 0, subtotal: 170000 },
      { id: 'item-2', transaction_id: 'trx-1', product_id: 'prod-3', product_name: 'Celana Jeans Slim Fit', product_price: 250000, quantity: 1, discount: 0, subtotal: 250000 },
    ],
    subtotal: 420000, discount_amount: 0, tax_amount: 0,
    service_charge_amount: 0, total: 420000,
    paid_amount: 500000, change_amount: 80000,
    payment_method: 'cash', status: 'completed',
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'trx-2', outlet_id: 'outlet-1',
    transaction_number: 'TRX-20240611-0002',
    customer_id: 'cust-2', customer: mockCustomers[1],
    cashier_id: 'emp-4', cashier: toUser(mockEmployees[3]),
    items: [
      { id: 'item-3', transaction_id: 'trx-2', product_id: 'prod-5', product_name: 'Earphone Bluetooth 5.0', product_price: 280000, quantity: 1, discount: 0, subtotal: 280000 },
    ],
    subtotal: 280000, discount_amount: 0, tax_amount: 0,
    service_charge_amount: 0, total: 280000,
    paid_amount: 280000, change_amount: 0,
    payment_method: 'qris', status: 'completed',
    created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: 'trx-3', outlet_id: 'outlet-1',
    transaction_number: 'TRX-20240611-0003',
    customer_id: undefined, customer: undefined,
    cashier_id: 'emp-3', cashier: toUser(mockEmployees[2]),
    items: [
      { id: 'item-4', transaction_id: 'trx-3', product_id: 'prod-6', product_name: 'Snack Keripik Singkong', product_price: 18000, quantity: 3, discount: 0, subtotal: 54000 },
      { id: 'item-5', transaction_id: 'trx-3', product_id: 'prod-8', product_name: 'Air Mineral 600ml', product_price: 5000, quantity: 5, discount: 0, subtotal: 25000 },
    ],
    subtotal: 79000, discount_amount: 5000, tax_amount: 0,
    service_charge_amount: 0, total: 74000,
    paid_amount: 100000, change_amount: 26000,
    payment_method: 'cash', status: 'completed',
    created_at: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
  },
  {
    id: 'trx-4', outlet_id: 'outlet-1',
    transaction_number: 'TRX-20240611-0004',
    customer_id: 'cust-4', customer: mockCustomers[3],
    cashier_id: 'emp-4', cashier: toUser(mockEmployees[3]),
    items: [
      { id: 'item-6', transaction_id: 'trx-4', product_id: 'prod-11', product_name: 'Jam Tangan Casual', product_price: 350000, quantity: 1, discount: 0, subtotal: 350000 },
      { id: 'item-7', transaction_id: 'trx-4', product_id: 'prod-10', product_name: 'Dompet Kulit Slim', product_price: 175000, quantity: 1, discount: 0, subtotal: 175000 },
    ],
    subtotal: 525000, discount_amount: 25000, tax_amount: 0,
    service_charge_amount: 0, total: 500000,
    paid_amount: 500000, change_amount: 0,
    payment_method: 'debit', status: 'completed',
    created_at: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
  },
  {
    id: 'trx-5', outlet_id: 'outlet-1',
    transaction_number: 'TRX-20240611-0005',
    customer_id: undefined, customer: undefined,
    cashier_id: 'emp-3', cashier: toUser(mockEmployees[2]),
    items: [
      { id: 'item-8', transaction_id: 'trx-5', product_id: 'prod-2', product_name: 'Kemeja Flanel Kotak', product_price: 195000, quantity: 1, discount: 0, subtotal: 195000 },
    ],
    subtotal: 195000, discount_amount: 0, tax_amount: 0,
    service_charge_amount: 0, total: 195000,
    paid_amount: 200000, change_amount: 5000,
    payment_method: 'cash', status: 'void',
    created_at: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
  },
]

// ─── Stock Movements ──────────────────
export const mockStockMovements: StockMovement[] = [
  { id: 'mov-1', outlet_id: 'outlet-1', product_id: 'prod-1', product: mockProducts[0], type: 'in', quantity: 50, before_stock: 0, after_stock: 50, notes: 'Stok awal', created_by: 'emp-1', created_by_name: 'Andi Wijaya', created_at: '2024-01-15T08:00:00' },
  { id: 'mov-2', outlet_id: 'outlet-1', product_id: 'prod-4', product: mockProducts[3], type: 'out', quantity: -5, before_stock: 5, after_stock: 0, notes: 'Terjual di POS', reference_id: 'trx-old', created_by: 'emp-3', created_by_name: 'Riko Andrian', created_at: '2024-06-10T14:30:00' },
  { id: 'mov-3', outlet_id: 'outlet-1', product_id: 'prod-9', product: mockProducts[8], type: 'in', quantity: 20, before_stock: 3, after_stock: 23, notes: 'Restock dari supplier', created_by: 'emp-2', created_by_name: 'Dewi Sartika', created_at: '2024-06-09T10:00:00' },
  { id: 'mov-4', outlet_id: 'outlet-1', product_id: 'prod-2', product: mockProducts[1], type: 'adjustment', quantity: -2, before_stock: 10, after_stock: 8, notes: 'Barang cacat/rusak', created_by: 'emp-2', created_by_name: 'Dewi Sartika', created_at: '2024-06-08T09:00:00' },
  { id: 'mov-5', outlet_id: 'outlet-1', product_id: 'prod-8', product: mockProducts[7], type: 'in', quantity: 100, before_stock: 100, after_stock: 200, notes: 'Pembelian rutin mingguan', created_by: 'emp-1', created_by_name: 'Andi Wijaya', created_at: '2024-06-07T08:00:00' },
]

// ─── Dashboard Data ───────────────────
export const mockDashboardStats: DashboardStats = {
  today_revenue: 3850000,
  today_transactions: 24,
  today_items_sold: 87,
  today_new_customers: 4,
  revenue_change: 12.5,
  transactions_change: 8.3,
  items_change: 15.2,
  customers_change: -5.0,
  low_stock_count: 3,
  out_of_stock_count: 1,
}

export const mockSalesChart: SalesChartData[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (29 - i))
  const dayOfWeek = date.getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  const baseRevenue = isWeekend ? 4500000 : 3200000
  const variance = (Math.random() - 0.5) * 1500000
  const revenue = Math.max(500000, Math.round(baseRevenue + variance))
  return {
    date: date.toISOString().slice(0, 10),
    label: date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    revenue,
    transactions: Math.round(revenue / 145000),
  }
})

export const mockTopProducts: TopProduct[] = [
  { product_id: 'prod-3', product_name: 'Celana Jeans Slim Fit', product_sku: 'CEL-001', total_sold: 145, total_revenue: 36250000, percentage: 24.5 },
  { product_id: 'prod-1', product_name: 'Kaos Polos Premium', product_sku: 'KAO-001', total_sold: 198, total_revenue: 16830000, percentage: 19.8 },
  { product_id: 'prod-5', product_name: 'Earphone Bluetooth 5.0', product_sku: 'EAR-001', total_sold: 67, total_revenue: 18760000, percentage: 15.2 },
  { product_id: 'prod-11', product_name: 'Jam Tangan Casual', product_sku: 'JAM-001', total_sold: 42, total_revenue: 14700000, percentage: 12.1 },
  { product_id: 'prod-8', product_name: 'Air Mineral 600ml', product_sku: 'AIR-001', total_sold: 520, total_revenue: 2600000, percentage: 8.9 },
]

export const mockLowStockItems: LowStockItem[] = [
  { product_id: 'prod-4', product_name: 'Powerbank 10000mAh', sku: 'PWB-001', current_stock: 0, min_stock: 5, category_name: 'Elektronik', status: 'out' },
  { product_id: 'prod-2', product_name: 'Kemeja Flanel Kotak', sku: 'KEM-001', current_stock: 8, min_stock: 10, category_name: 'Pakaian', status: 'low' },
  { product_id: 'prod-9', product_name: 'Kopi Sachet Premium', sku: 'KOP-001', current_stock: 3, min_stock: 15, category_name: 'Minuman', status: 'low' },
]

// ─── Promotions ───────────────────────
export const mockPromotions: Promotion[] = [
  {
    id: 'promo-1', outlet_id: 'outlet-1', name: 'Diskon 10% Pakaian',
    type: 'percentage', value: 10, category_ids: ['cat-1'],
    used_count: 34, starts_at: '2024-06-01', ends_at: '2024-06-30',
    is_active: true, created_at: '2024-06-01',
  },
  {
    id: 'promo-2', outlet_id: 'outlet-1', name: 'Voucher Hemat 20rb',
    type: 'fixed', value: 20000, min_purchase: 150000,
    code: 'HEMAT20', max_uses: 100, used_count: 67,
    starts_at: '2024-06-01', ends_at: '2024-06-15',
    is_active: true, created_at: '2024-06-01',
  },
  {
    id: 'promo-3', outlet_id: 'outlet-1', name: 'Flash Sale Elektronik',
    type: 'percentage', value: 20, category_ids: ['cat-2'],
    used_count: 12, starts_at: '2024-06-11', ends_at: '2024-06-11',
    is_active: false, created_at: '2024-06-10',
  },
]
