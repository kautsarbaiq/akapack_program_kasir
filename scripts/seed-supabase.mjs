// Seed data contoh AKAPACK ke Supabase.
// Jalankan: node scripts/seed-supabase.mjs   (idempotent: skip kalau sudah ada produk)
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m) env[m[1]] = m[2].trim()
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const T = '00000000-0000-0000-0000-000000000001'

const { count } = await sb.from('products').select('*', { count: 'exact', head: true })
if (count && count > 0) {
  console.log(`ℹ️  Sudah ada ${count} produk di DB — seed dilewati (hindari duplikat).`)
  process.exit(0)
}

// — Kategori —
const categories = [
  { name: 'Pakaian', color: '#3B82F6', icon: '👕', sort_order: 1 },
  { name: 'Elektronik', color: '#8B5CF6', icon: '💻', sort_order: 2 },
  { name: 'Makanan', color: '#F59E0B', icon: '🍜', sort_order: 3 },
  { name: 'Minuman', color: '#10B981', icon: '☕', sort_order: 4 },
  { name: 'Aksesoris', color: '#EF4444', icon: '⌚', sort_order: 5 },
  { name: 'Alat Tulis', color: '#06B6D4', icon: '✏️', sort_order: 6 },
]
const { data: catRows, error: catErr } = await sb
  .from('categories')
  .insert(categories.map((c) => ({ ...c, tenant_id: T, is_active: true })))
  .select('id, name')
if (catErr) { console.error('❌ kategori:', catErr.message); process.exit(1) }
const catId = Object.fromEntries(catRows.map((c) => [c.name, c.id]))
console.log(`✅ ${catRows.length} kategori`)

// — Produk —
const products = [
  ['Kaos Polos Premium', 'Pakaian', 'KAO-001', '8991234567890', 85000, 45000, 50, 10, 'pcs'],
  ['Kemeja Flanel Kotak', 'Pakaian', 'KEM-001', '8991234567891', 195000, 95000, 8, 10, 'pcs'],
  ['Celana Jeans Slim Fit', 'Pakaian', 'CEL-001', '8991234567892', 250000, 120000, 25, 5, 'pcs'],
  ['Powerbank 10000mAh', 'Elektronik', 'PWB-001', '8991234567893', 150000, 85000, 0, 5, 'unit'],
  ['Earphone Bluetooth 5.0', 'Elektronik', 'EAR-001', '8991234567894', 280000, 150000, 15, 5, 'unit'],
  ['Snack Keripik Singkong', 'Makanan', 'SNK-001', '8991234567895', 18000, 10000, 100, 20, 'pcs'],
  ['Cokelat Premium 100gr', 'Makanan', 'COK-001', '8991234567896', 35000, 20000, 45, 10, 'pcs'],
  ['Air Mineral 600ml', 'Minuman', 'AIR-001', '8991234567897', 5000, 3000, 200, 50, 'pcs'],
  ['Kopi Sachet Premium', 'Minuman', 'KOP-001', '8991234567898', 25000, 15000, 3, 15, 'box'],
  ['Dompet Kulit Slim', 'Aksesoris', 'DMP-001', '8991234567899', 175000, 85000, 12, 5, 'pcs'],
  ['Jam Tangan Casual', 'Aksesoris', 'JAM-001', '8991234567900', 350000, 180000, 7, 3, 'pcs'],
  ['Pulpen Gel Premium', 'Alat Tulis', 'PUL-001', '8991234567901', 8000, 4000, 150, 30, 'pcs'],
]
const { error: prodErr } = await sb.from('products').insert(
  products.map(([name, cat, sku, barcode, price, cost_price, stock, min_stock, unit]) => ({
    tenant_id: T, category_id: catId[cat], name, sku, barcode, price, cost_price,
    price_online: price, price_market: Math.round(price * 1.15), stock, min_stock, unit, is_active: true,
  }))
)
if (prodErr) { console.error('❌ produk:', prodErr.message); process.exit(1) }
console.log(`✅ ${products.length} produk`)

// — Pelanggan —
const customers = [
  ['Budi Santoso', '081234567890', 'budi@email.com', 'Jl. Merdeka No. 10, Jakarta', 2500, 4750000, 28],
  ['Sari Dewi', '082345678901', 'sari@email.com', 'Jl. Sudirman No. 25, Jakarta', 1800, 3200000, 19],
  ['Ahmad Rizki', '083456789012', null, 'Jl. Gatot Subroto No. 5, Bandung', 950, 1850000, 12],
  ['Rina Kusuma', '084567890123', 'rina@email.com', 'Jl. Asia Afrika No. 12, Bandung', 3200, 6100000, 35],
  ['Doni Pratama', '085678901234', 'doni@email.com', 'Jl. Diponegoro No. 8, Surabaya', 450, 875000, 6],
]
const { error: custErr } = await sb.from('customers').insert(
  customers.map(([name, phone, email, address, points, total_spent, total_transactions]) => ({
    tenant_id: T, name, phone, email, address, points, total_spent, total_transactions,
  }))
)
if (custErr) { console.error('❌ pelanggan:', custErr.message); process.exit(1) }
console.log(`✅ ${customers.length} pelanggan`)

// — Karyawan —
const employees = [
  ['Andi Wijaya', 'owner', '081111111111', 'andi@akapack.com', null, true],
  ['Dewi Sartika', 'manager', '082222222222', 'dewi@akapack.com', null, true],
  ['Riko Andrian', 'cashier', '083333333333', null, '1234', true],
  ['Fitri Rahayu', 'cashier', '084444444444', null, '5678', true],
  ['Hendra Gunawan', 'cashier', '085555555555', null, '9012', false],
]
const { error: empErr } = await sb.from('employees').insert(
  employees.map(([name, role, phone, email, pin, is_active]) => ({ tenant_id: T, name, role, phone, email, pin, is_active }))
)
if (empErr) { console.error('❌ karyawan:', empErr.message); process.exit(1) }
console.log(`✅ ${employees.length} karyawan`)

// — Promosi —
const promotions = [
  ['Diskon 10% Pakaian', 'percentage', 10, null, null, null, 34, '2026-06-01', '2026-06-30', true],
  ['Voucher Hemat 20rb', 'fixed', 20000, 150000, 'HEMAT20', 100, 67, '2026-06-01', '2026-06-30', true],
  ['Flash Sale Elektronik', 'percentage', 20, null, null, null, 12, '2026-06-11', '2026-06-15', false],
]
const { error: promoErr } = await sb.from('promotions').insert(
  promotions.map(([name, type, value, min_purchase, code, max_uses, used_count, starts_at, ends_at, is_active]) => ({
    tenant_id: T, name, type, value, min_purchase, code, max_uses, used_count, starts_at, ends_at, is_active,
  }))
)
if (promoErr) { console.error('❌ promosi:', promoErr.message); process.exit(1) }
console.log(`✅ ${promotions.length} promosi`)

console.log('\n🎉 Seed selesai! Restart `pnpm dev` lalu buka dashboard.')
