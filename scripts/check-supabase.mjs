// Diagnosa koneksi Supabase AKAPACK.
// Jalankan dari root proyek:  node scripts/check-supabase.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// — baca .env.local —
const env = {}
try {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m) env[m[1]] = m[2].trim()
  }
} catch (e) {
  console.error('❌ Tidak bisa baca .env.local:', e.message)
  process.exit(1)
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const TENANT = '00000000-0000-0000-0000-000000000001'

console.log('🔎 Cek konfigurasi')
console.log('   URL        :', url || '(kosong)')
console.log('   Key length :', key ? key.length + ' char' : '(kosong)')

if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  console.error('\n❌ URL tidak valid. Harus seperti https://xxxxx.supabase.co (tanpa /rest/v1/).')
  process.exit(1)
}
if (!key || key.length < 40) {
  console.error('\n❌ Anon key tampak terpotong (<40 char). Copy ulang dari Supabase → Settings → API → anon public.')
  process.exit(1)
}

const sb = createClient(url, key)
const tables = ['tenants', 'profiles', 'categories', 'products', 'customers', 'employees', 'shifts', 'transactions', 'transaction_items', 'stock_movements', 'promotions']

console.log('\n🔎 Cek tabel')
let allOk = true
for (const t of tables) {
  const { error } = await sb.from(t).select('*').limit(1)
  if (error) { console.log(`   ❌ ${t}: ${error.message}`); allOk = false }
  else console.log(`   ✅ ${t}`)
}

console.log('\n🔎 Cek migration 0002 (kolom tenant_id)')
const { error: colErr } = await sb.from('products').select('tenant_id, price_online').limit(1)
if (colErr) { console.log('   ❌ Kolom 0002 belum ada — jalankan supabase/migrations/0002_tenant_pricing_audit.sql.\n     ', colErr.message); allOk = false }
else console.log('   ✅ Kolom tenant_id & price_online ada (0002 sudah dijalankan)')

console.log('\n🔎 Tes tulis (insert + hapus kategori uji)')
const { data: ins, error: insErr } = await sb
  .from('categories')
  .insert({ name: '__cek_koneksi__', tenant_id: TENANT, color: '#000000', icon: '🔧' })
  .select('id')
  .single()
if (insErr) { console.log('   ❌ Tes tulis gagal:', insErr.message); allOk = false }
else {
  console.log('   ✅ Insert berhasil (id:', ins.id + ')')
  const { error: delErr } = await sb.from('categories').delete().eq('id', ins.id)
  console.log(delErr ? `   ⚠️  Gagal hapus data uji: ${delErr.message}` : '   ✅ Data uji dibersihkan')
}

console.log(
  allOk
    ? '\n🎉 SUPABASE SIAP! Restart `pnpm dev` — data akan tersimpan nyata.'
    : '\n⚠️  Ada masalah di atas. Perbaiki dulu, lalu jalankan ulang skrip ini.'
)
process.exit(allOk ? 0 : 1)
