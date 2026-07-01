export const APP_NAME = 'AKAPACK'
export const APP_DESCRIPTION = 'Platform POS & Manajemen Retail'

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: 'Banknote' },
  { value: 'transfer_bca', label: 'Transfer BCA', icon: 'Landmark' },
  { value: 'transfer_mandiri', label: 'Transfer Mandiri', icon: 'Landmark' },
  { value: 'qris', label: 'QRIS', icon: 'QrCode' },
  { value: 'shopee', label: 'Shopee', icon: 'ShoppingBag' },
  { value: 'tiktok', label: 'Tiktok-Tokped', icon: 'Music2' },
  { value: 'lazada', label: 'Lazada', icon: 'ShoppingCart' },
  { value: 'blibli', label: 'Beli Bli', icon: 'Store' },
] as const

/** Label tampilan per metode bayar (termasuk 'split' untuk pembayaran gabungan). */
export const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash', transfer_bca: 'Transfer BCA', transfer_mandiri: 'Transfer Mandiri', qris: 'QRIS',
  shopee: 'Shopee', tiktok: 'Tiktok-Tokped', lazada: 'Lazada', blibli: 'Beli Bli', split: 'Split',
}

/** Warna badge metode bayar (daftar & laporan penjualan). */
export const PAYMENT_COLORS: Record<string, string> = {
  cash: 'bg-emerald-100 text-emerald-700',
  transfer_bca: 'bg-blue-100 text-blue-700',
  transfer_mandiri: 'bg-amber-100 text-amber-700',
  qris: 'bg-cyan-100 text-cyan-700',
  shopee: 'bg-orange-100 text-orange-700',
  tiktok: 'bg-neutral-200 text-neutral-700',
  lazada: 'bg-indigo-100 text-indigo-700',
  blibli: 'bg-sky-100 text-sky-700',
  split: 'bg-purple-100 text-purple-700',
}

export const PRODUCT_UNITS = [
  'pcs',
  'buah',
  'unit',
  'kg',
  'gram',
  'liter',
  'ml',
  'lusin',
  'karton',
  'box',
  'pack',
  'roll',
  'meter',
  'lembar',
]

export const ROLES = [
  { value: 'owner', label: 'Pemilik / Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Kasir' },
  { value: 'sales', label: 'Sales' },
] as const

export const NAV_ITEMS = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: 'LayoutDashboard',
  },
  {
    title: 'POS Kasir',
    href: '/pos',
    icon: 'ShoppingCart',
  },
  {
    title: 'Produk',
    href: '/dashboard/produk',
    icon: 'Package',
    children: [
      { title: 'Katalog Produk', href: '/dashboard/produk' },
      { title: 'Kategori', href: '/dashboard/produk/kategori' },
      { title: 'Import / Export', href: '/dashboard/produk/import' },
    ],
  },
  {
    title: 'Inventori',
    href: '/dashboard/inventori',
    icon: 'Warehouse',
    children: [
      { title: 'Stok Saat Ini', href: '/dashboard/inventori' },
      { title: 'Pergerakan Stok', href: '/dashboard/inventori/pergerakan' },
      { title: 'Stock Opname', href: '/dashboard/inventori/opname' },
    ],
  },
  {
    title: 'Penjualan',
    href: '/dashboard/penjualan',
    icon: 'Receipt',
    children: [
      { title: 'Riwayat Transaksi', href: '/dashboard/penjualan' },
      { title: 'Laporan', href: '/dashboard/penjualan/laporan' },
    ],
  },
  {
    title: 'Pelanggan',
    href: '/dashboard/pelanggan',
    icon: 'Users',
  },
  {
    title: 'Promosi',
    href: '/dashboard/promosi',
    icon: 'Tag',
    children: [
      { title: 'Diskon', href: '/dashboard/promosi' },
      { title: 'Voucher', href: '/dashboard/promosi/voucher' },
    ],
  },
  {
    title: 'Karyawan',
    href: '/dashboard/karyawan',
    icon: 'UserCheck',
  },
  {
    title: 'Laporan',
    href: '/dashboard/laporan',
    icon: 'BarChart3',
  },
  {
    title: 'Pengaturan',
    href: '/dashboard/pengaturan',
    icon: 'Settings',
  },
] as const
