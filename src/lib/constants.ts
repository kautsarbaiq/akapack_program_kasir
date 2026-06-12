export const APP_NAME = 'AKAPACK'
export const APP_DESCRIPTION = 'Platform POS & Manajemen Retail'

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Tunai', icon: 'Banknote' },
  { value: 'qris', label: 'QRIS', icon: 'QrCode' },
  { value: 'debit', label: 'Kartu Debit', icon: 'CreditCard' },
  { value: 'credit', label: 'Kartu Kredit', icon: 'CreditCard' },
  { value: 'transfer', label: 'Transfer Bank', icon: 'ArrowLeftRight' },
  { value: 'ewallet', label: 'E-Wallet', icon: 'Smartphone' },
  { value: 'split', label: 'Split Payment', icon: 'Split' },
] as const

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
