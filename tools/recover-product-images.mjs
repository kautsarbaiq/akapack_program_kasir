#!/usr/bin/env node
/**
 * PEMULIHAN FOTO PRODUK — dari storage proyek Supabase LAMA ke proyek BARU.
 *
 * Kapan dipakai: SETELAH blokir proyek lama (HTTP 402 "exceed_*_quota") dilepas —
 * yaitu setelah owner meng-upgrade proyek lama sebentar ATAU kuota bulanannya reset.
 *
 * Jalankan:
 *   node tools/recover-product-images.mjs --check     # cek apakah proyek lama sudah bisa diakses
 *   node tools/recover-product-images.mjs             # jalankan pemulihan penuh
 *
 * Aman diulang (resume): file yang sudah tersalin dilewati, jadi kalau putus tinggal jalankan lagi.
 * Langkah: siapkan bucket → salin file lama → baru → arahkan ulang URL produk di database.
 */
import { readFileSync } from 'fs'
import { execFileSync } from 'child_process'

const ROOT = new URL('..', import.meta.url).pathname
const env = (file) => Object.fromEntries(
  readFileSync(ROOT + file, 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const cur = env('.env.local')
const old = env('.env.local.bak-supabase-lama')
const NEW_URL = cur.NEXT_PUBLIC_SUPABASE_URL
const NEW_KEY = cur.NEXT_PUBLIC_SUPABASE_ANON_KEY
const OLD_URL = old.NEXT_PUBLIC_SUPABASE_URL
const OLD_KEY = old.NEXT_PUBLIC_SUPABASE_ANON_KEY
const OLD_REF = OLD_URL.replace(/^https?:\/\//, '').split('.')[0]
const NEW_REF = NEW_URL.replace(/^https?:\/\//, '').split('.')[0]
const BUCKET = 'product-images'
// Password DB proyek BARU (untuk membuat bucket + izin). Bisa dioverride via env NEW_DB_PASSWORD.
const NEW_DB_PASSWORD = process.env.NEW_DB_PASSWORD || 'GiFpSNJNbRGAJf6A'

const h = (key) => ({ apikey: key, authorization: `Bearer ${key}` })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function oldIsUnlocked() {
  const r = await fetch(`${OLD_URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST', headers: { ...h(OLD_KEY), 'content-type': 'application/json' },
    body: JSON.stringify({ limit: 1, prefix: '' }),
  })
  return { ok: r.ok, status: r.status, body: (await r.text()).slice(0, 200) }
}

async function main() {
  console.log(`Proyek LAMA: ${OLD_REF}\nProyek BARU: ${NEW_REF}\n`)

  const probe = await oldIsUnlocked()
  if (!probe.ok) {
    console.log(`❌ Proyek lama MASIH TERKUNCI (HTTP ${probe.status}).`)
    console.log(`   ${probe.body}`)
    console.log('\n   Foto belum bisa diambil. Buka blokirnya dulu di supabase.com')
    console.log('   (upgrade proyek LAMA sebentar, atau tunggu kuota reset), lalu jalankan lagi.')
    process.exit(1)
  }
  console.log('✅ Proyek lama BISA DIAKSES — mulai pemulihan.\n')
  if (process.argv.includes('--check')) return

  // 1) Siapkan bucket publik di proyek baru (via koneksi DB langsung — tak butuh service key).
  console.log('1/4 Menyiapkan bucket di proyek baru…')
  const sql = `
    insert into storage.buckets (id, name, public) values ('${BUCKET}', '${BUCKET}', true)
      on conflict (id) do update set public = true;
    drop policy if exists "akapack_read" on storage.objects;
    drop policy if exists "akapack_write" on storage.objects;
    create policy "akapack_read"  on storage.objects for select using (bucket_id = '${BUCKET}');
    create policy "akapack_write" on storage.objects for insert with check (bucket_id = '${BUCKET}');
  `
  execFileSync('psql', [
    `host=db.${NEW_REF}.supabase.co port=5432 dbname=postgres user=postgres sslmode=require`,
    '-v', 'ON_ERROR_STOP=1', '-c', sql,
  ], { env: { ...process.env, PGPASSWORD: NEW_DB_PASSWORD, PGCONNECT_TIMEOUT: '20' }, stdio: 'inherit' })

  // 2) Daftar file di storage lama (paginasi).
  console.log('\n2/4 Mengambil daftar file lama…')
  const files = []
  for (let offset = 0; ; offset += 100) {
    const r = await fetch(`${OLD_URL}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST', headers: { ...h(OLD_KEY), 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }),
    })
    const page = await r.json()
    if (!Array.isArray(page) || page.length === 0) break
    files.push(...page.map((f) => f.name))
    if (page.length < 100) break
  }
  console.log(`   ${files.length} file ditemukan.`)

  // File yang SUDAH ada di proyek baru → dilewati (resume).
  const done = new Set()
  for (let offset = 0; ; offset += 100) {
    const r = await fetch(`${NEW_URL}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST', headers: { ...h(NEW_KEY), 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 100, offset }),
    })
    const page = await r.json().catch(() => [])
    if (!Array.isArray(page) || page.length === 0) break
    page.forEach((f) => done.add(f.name))
    if (page.length < 100) break
  }
  if (done.size) console.log(`   ${done.size} sudah tersalin sebelumnya → dilewati.`)

  // 3) Salin file: unduh dari lama → unggah ke baru.
  console.log('\n3/4 Menyalin file…')
  let ok = 0, fail = 0
  for (const [i, name] of files.entries()) {
    if (done.has(name)) continue
    try {
      const src = await fetch(`${OLD_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(name)}`)
      if (!src.ok) throw new Error(`unduh ${src.status}`)
      const buf = Buffer.from(await src.arrayBuffer())
      const up = await fetch(`${NEW_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { ...h(NEW_KEY), 'content-type': src.headers.get('content-type') || 'image/jpeg', 'x-upsert': 'true' },
        body: buf,
      })
      if (!up.ok) throw new Error(`unggah ${up.status} ${(await up.text()).slice(0, 120)}`)
      ok++
    } catch (e) {
      fail++
      if (fail <= 5) console.log(`   ! gagal ${name}: ${e.message}`)
    }
    if ((i + 1) % 100 === 0) { console.log(`   ${i + 1}/${files.length} (ok ${ok}, gagal ${fail})`); await sleep(200) }
  }
  console.log(`   selesai — tersalin ${ok}, gagal ${fail}`)

  // 4) Arahkan ulang URL produk: ref lama → ref baru.
  console.log('\n4/4 Memperbarui URL foto di database…')
  execFileSync('psql', [
    `host=db.${NEW_REF}.supabase.co port=5432 dbname=postgres user=postgres sslmode=require`,
    '-v', 'ON_ERROR_STOP=1', '-c',
    `update products set image_url = replace(image_url, '${OLD_REF}.supabase.co', '${NEW_REF}.supabase.co')
       where image_url like '%${OLD_REF}.supabase.co%';`,
  ], { env: { ...process.env, PGPASSWORD: NEW_DB_PASSWORD, PGCONNECT_TIMEOUT: '20' }, stdio: 'inherit' })

  console.log('\n🎉 SELESAI. Langkah terakhir:')
  console.log('   Kosongkan UNAVAILABLE_IMAGE_HOSTS di src/components/product-img.tsx, lalu deploy.')
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
