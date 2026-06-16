# 🔌 Panduan Integrasi Supabase — AKAPACK (Fase B)

Dokumen ini memandu kamu menyambungkan AKAPACK ke backend nyata (Supabase) supaya
data benar-benar tersimpan permanen (saat ini data masih di memori via Zustand,
hilang kalau halaman di-refresh).

> **Status sekarang:** Fase A selesai — semua CRUD berfungsi pakai mock data + Zustand store.
> Titik sambung ke Supabase sudah disiapkan rapi: cukup ubah isi store, UI tidak perlu diubah.

---

## Langkah 1 — Buat Project Supabase (gratis, ±5 menit)

1. Buka **https://supabase.com** → klik **Start your project** → login pakai GitHub/Google.
2. Klik **New project**.
   - **Name:** `akapack`
   - **Database Password:** buat password kuat → **SIMPAN** (dipakai kalau akses DB langsung).
   - **Region:** pilih **Southeast Asia (Singapore)** — paling dekat dari Indonesia.
3. Tunggu ±2 menit sampai project selesai dibuat.

## Langkah 2 — Ambil Kredensial

Di dashboard project: **Project Settings (ikon gear)** → **API**. Catat 2 nilai ini:

| Nama | Contoh | Dipakai untuk |
|------|--------|---------------|
| **Project URL** | `https://xxxxx.supabase.co` | Alamat API |
| **anon public key** | `eyJhbGciOi...` (panjang) | Key publik untuk client |

> ⚠️ Jangan pakai `service_role` key di kode frontend — itu rahasia, hanya untuk server.

## Langkah 3 — Buat file `.env.local`

Buat file baru `.env.local` di root proyek (`~/Documents/akapack/.env.local`), isi:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> File ini sudah otomatis di-ignore git (lihat `.gitignore`), jadi aman.

## Langkah 4 — Buat Tabel Database

1. Di dashboard Supabase → menu **SQL Editor** → **New query**.
2. Buka file **`supabase/migrations/0001_init.sql`** di proyek ini, **copy semua isinya**.
3. Paste ke SQL Editor → klik **Run**.
4. Cek menu **Table Editor** — harusnya muncul tabel: `outlets`, `categories`, `products`,
   `customers`, `employees`, `shifts`, `transactions`, `transaction_items`,
   `stock_movements`, `promotions`.

## Langkah 5 — Kasih tahu saya 👋

Setelah Langkah 1–4 selesai, **beri tahu saya** (boleh kirim Project URL-nya, anon key
tidak wajib ditempel di chat — cukup pastikan sudah ada di `.env.local`). Saya akan lanjut:

- [ ] Buat client Supabase (`src/lib/supabase/client.ts` + `server.ts`)
- [ ] Seed data awal (1 outlet + kategori + beberapa produk) supaya tidak kosong
- [ ] Ubah tiap Zustand store agar baca/tulis ke Supabase (UI tetap sama)
- [ ] Sambungkan Supabase Auth ke halaman Login/Register
- [ ] Proteksi route dashboard (middleware)
- [ ] Checkout POS → simpan transaksi nyata + stok berkurang permanen
- [ ] Upload foto produk & logo ke Supabase Storage
- [ ] (Opsional) Realtime: stok update langsung lintas perangkat

---

## Kenapa migrasinya nanti gampang?

Di Fase A saya sengaja menaruh **semua akses data di satu tempat per entitas**
(`src/stores/*`). Komponen & halaman tidak pernah memanggil mock data langsung —
mereka panggil store. Jadi saat pindah ke Supabase, yang berubah **hanya isi store**:

```ts
// SEKARANG (mock, sinkron):
addProduct: (values) => set((s) => ({ products: [buat(values), ...s.products] }))

// NANTI (Supabase, async) — UI tidak berubah:
addProduct: async (values) => {
  const { data } = await supabase.from('products').insert(values).select().single()
  set((s) => ({ products: [data, ...s.products] }))
}
```

Itulah kenapa langkah "buat 7 store" di Fase A penting — bukan sekadar bikin mock jalan,
tapi menyiapkan jembatan ke backend.

---

## Estimasi biaya

Supabase **Free tier** cukup untuk mulai & internal: 500 MB database, 1 GB storage,
50.000 monthly active users, 5 GB bandwidth. Naik ke Pro (~$25/bln) hanya kalau sudah
butuh lebih. Untuk 1 toko internal, free tier lebih dari cukup.
