# 📋 AKAPACK — Task Progress Tracker

> **Mulai:** Juni 2026 | **Stack:** Next.js 16 + Supabase + Tailwind v4 + shadcn/ui + Tauri
> **Build Status:** ✅ Build produksi sukses — 20 halaman, typecheck & lint bersih (0 error)

## ✅ Update Fase A — Claude Code (16 Juni 2026)
CRUD kini **benar-benar berfungsi** (bukan sekadar toast) lewat Zustand store (`src/stores/`):
- 7 dialog/modal selesai: produk, kategori, pelanggan, karyawan, promosi + POS (shift, struk, pilih pelanggan)
- **Checkout POS end-to-end:** simpan transaksi → stok berkurang → poin pelanggan bertambah → muncul di Riwayat Transaksi & Inventori
- 4 type error lama di `product-form-dialog` **diperbaiki**; schema zod dipusatkan di `src/lib/validations/`
- Bug emoji kategori POS diperbaiki (`cat.icon` kini emoji); warning workspace-root build hilang
- **Next:** integrasi Supabase — ikuti `SUPABASE_SETUP.md` + `supabase/migrations/0001_init.sql`

---

## ⚡ Phase 1 — Foundation & Setup

### Setup & Config
- [x] Setup Next.js 15 + TypeScript + Tailwind CSS v4
- [x] Install dependencies (shadcn/ui, supabase, zustand, tanstack query, recharts, zod, react-hook-form, sonner)
- [x] Install semua shadcn/ui components (dialog, alert-dialog, sheet, select, scroll-area, switch, avatar, dll)
- [x] Design system AKAPACK (dark navy + electric blue theme di globals.css)
- [x] Setup file types/index.ts (semua TypeScript interfaces)
- [x] Setup lib/utils.ts (formatRupiah, formatDate, getInitials, dll)
- [x] Setup lib/mock-data.ts (data dummy realistis semua modul)
- [ ] Konfigurasi Supabase project (belum — masih mock data)
- [ ] Database schema & migrations Supabase (belum)

### Auth System
- [x] Halaman Login — email + password + validasi zod + show/hide password
- [x] Halaman Register — nama, usaha, password strength indicator, konfirmasi
- [x] Halaman Lupa Password — input email + success state
- [x] Auth layout — split panel premium (branding kiri + form kanan)
- [x] Redirect root "/" ke "/login"
- [ ] Supabase Auth integration (belum)
- [ ] Protected routes / middleware (belum)
- [ ] Session management & persist (belum)

### Layout & Navigation
- [x] Layout dashboard — sidebar + header + content area
- [x] Sidebar navigasi premium (dark navy, collapsible, submenu expand/collapse)
- [x] Header (search bar, notifikasi badge, user dropdown menu)
- [x] Mobile overlay (klik overlay tutup sidebar)
- [x] Active route highlighting (sidebar item)
- [x] Breadcrumb di header per halaman
- [ ] Loading skeleton states (belum)
- [ ] Toast error handler global (belum)

### Dashboard Home
- [x] Greeting section (nama user + tanggal Indonesia)
- [x] KPI Cards — omzet, transaksi, produk terjual, pelanggan baru + % change
- [x] Grafik penjualan 30 hari (AreaChart recharts + gradient fill)
- [x] Top 5 produk terlaris (dengan progress bar kontribusi)
- [x] Alert stok menipis widget (dengan badge merah/kuning)
- [x] Tabel 5 transaksi terbaru (dengan badge status + metode bayar)
- [x] Tombol shortcut "Buka POS Kasir"
- [ ] Filter periode grafik (7H/30H/3Bulan — UI ada, logic belum connect)
- [ ] Data real dari Supabase (belum)

---

## 🏪 Phase 2 — Produk & Inventori

### Manajemen Produk
- [x] Halaman daftar produk — Table View + Grid View (toggle)
- [x] Search produk by nama/SKU/barcode
- [x] Filter by kategori, status, status stok
- [x] Stats bar: Total Produk, Produk Aktif, Stok Menipis, Stok Habis
- [x] Stock badge berwarna (Aman=hijau, Menipis=amber, Habis=merah)
- [x] Tombol Hapus produk + AlertDialog konfirmasi
- [x] Tombol Import & Export (UI placeholder)
- [ ] Form tambah produk (dialog form belum dibuat)
- [ ] Form edit produk (belum)
- [ ] Upload foto produk (belum)
- [ ] Barcode/SKU auto-generate (belum)
- [ ] Import Excel (.xlsx) functional (belum)
- [ ] Export Excel functional (belum)

### Kategori Produk
- [x] Halaman grid kategori dengan warna unik & emoji icon
- [x] Card kategori menampilkan jumlah produk
- [x] Tombol Edit & Delete per kategori (UI)
- [x] Card "Tambah Kategori" (placeholder)
- [ ] Dialog form tambah/edit kategori (belum)
- [ ] Delete kategori dengan konfirmasi (belum)
- [ ] Assign warna & icon custom (belum)

### Manajemen Stok / Inventori
- [x] Halaman inventori — tabel stok semua produk
- [x] Summary: Total SKU, Nilai Stok, Stok Menipis, Stok Habis
- [x] Filter stok by status (Aman/Menipis/Habis)
- [x] Search produk di inventori
- [x] Dialog tambah stok (pilih produk, qty, catatan)
- [x] Halaman pergerakan stok — riwayat IN/OUT/ADJUSTMENT
- [x] Badge tipe pergerakan berwarna
- [x] Filter pergerakan by tipe
- [ ] Stock opname (form input qty aktual per produk — belum)
- [ ] Auto-record pergerakan saat transaksi POS (belum)

---

## 💳 Phase 3 — POS Kasir

### Layout & UI Kasir
- [x] Layout POS fullscreen (dark header tanpa sidebar dashboard)
- [x] Sidebar kategori kiri — icon emoji + nama + active state
- [x] Grid produk (3-4 kolom, touchscreen-friendly)
- [x] Badge qty di pojok kartu produk jika sudah di cart
- [x] Search produk real-time di POS
- [x] Disabled overlay merah "HABIS" untuk stok = 0
- [x] Panel keranjang kanan (fixed 384px)
- [x] Selector pelanggan (placeholder button)

### Keranjang & Transaksi
- [x] Tambah produk ke cart (klik kartu)
- [x] Counter quantity +/- per item di cart
- [x] Hapus item dari cart
- [x] Input diskon nominal total
- [x] Kalkulasi subtotal & total realtime
- [x] Tombol Batal (clear cart)

### Pembayaran
- [x] 6 metode pembayaran (Tunai, QRIS, Debit, Kredit, Transfer, E-Wallet)
- [x] Toggle visual metode bayar (border + background biru)
- [x] Input nominal bayar (untuk tunai)
- [x] Quick amount buttons (50rb, 100rb, 200rb, 500rb, Pas)
- [x] Kalkulasi kembalian realtime
- [x] Dialog konfirmasi pembayaran (ringkasan order + total + kembalian)
- [x] Animasi sukses setelah transaksi dikonfirmasi
- [x] Cart otomatis kosong setelah sukses
- [ ] QRIS — tampilkan QR code placeholder (belum)
- [ ] Split payment (bayar dengan 2 metode — belum)
- [ ] Hold order / tahan pesanan (belum)
- [ ] Diskon per item (belum — hanya diskon total)

### Shift & Struk
- [ ] Buka shift (input kas awal — belum)
- [ ] Tutup shift + laporan shift (belum)
- [ ] Generate struk PDF / thermal (belum)
- [ ] Print struk ke printer thermal (belum)
- [ ] Kirim struk digital via WhatsApp/email (belum)

---

## 📊 Phase 4 — Laporan & CRM

### Laporan Penjualan
- [x] Halaman overview laporan (cards + link ke sub-laporan)
- [x] Halaman riwayat transaksi (tabel lengkap + filter status & metode)
- [x] Stats: total transaksi, total omzet, rata-rata per transaksi
- [x] Sheet detail transaksi (slide-in dari kanan — item list, summary, tombol void/cetak)
- [x] Halaman laporan penjualan dengan 3 tabs:
  - [x] Tab Ringkasan — KPI + AreaChart tren penjualan
  - [x] Tab Per Produk — tabel top produk + progress bar kontribusi
  - [x] Tab Per Metode Bayar — PieChart + tabel breakdown
- [x] Filter periode: 7H, 30H, 3 Bulan
- [ ] Tab Per Kasir (belum)
- [ ] Export Excel & PDF functional (belum)
- [ ] Laporan Laba/Rugi — HPP vs omzet (belum)

### CRM Pelanggan
- [x] Halaman database pelanggan (tabel + search)
- [x] Stats: total pelanggan, total poin beredar, avg spending
- [x] Avatar inisial berwarna random berdasarkan nama
- [x] Sheet detail pelanggan (info lengkap + 4 stat cards + aksi)
- [x] Tombol Edit & Tambah Poin (UI placeholder)
- [ ] Dialog form tambah/edit pelanggan (belum)
- [ ] Riwayat transaksi per pelanggan di sheet (belum)
- [ ] Sistem poin loyalty — earn & redeem (belum)
- [ ] Kartu member digital (belum)
- [ ] Export database pelanggan (belum)

### Promosi & Voucher
- [x] Halaman promosi (grid card per promo)
- [x] Stats: total, aktif, total penggunaan
- [x] Card promo: nama, tipe, nilai, kode voucher, periode, progress penggunaan
- [x] Badge status Aktif/Tidak Aktif
- [x] Toggle aktif/nonaktif (UI)
- [ ] Dialog form buat/edit promosi (belum)
- [ ] Apply promo code di POS kasir (belum)
- [ ] BOGO / Bundle promo (belum)
- [ ] Flash sale dengan countdown timer (belum)

### Karyawan
- [x] Halaman karyawan (grid card layout)
- [x] Card: avatar, nama, role badge warna, HP, PIN (tersembunyi)
- [x] Role badges: Pemilik (ungu), Manager (biru), Kasir (abu)
- [x] Toggle aktif/nonaktif dengan animasi + toast
- [ ] Dialog form tambah/edit karyawan (belum)
- [ ] Manajemen PIN kasir (belum)
- [ ] Hak akses per role (belum)
- [ ] Jadwal & shift karyawan (belum)

### Pengaturan
- [x] Tab Profil Toko — nama, alamat, telepon, email, logo
- [x] Tab Pajak & Biaya — toggle PPN + input rate + preview hitungan
- [x] Tab Service Charge — toggle + input rate
- [x] Tab Struk — toggle logo/alamat + input footer + preview struk live
- [x] Tab Notifikasi — toggle email alert stok + laporan harian
- [ ] Simpan ke database Supabase (belum — hanya UI)
- [ ] Upload logo toko functional (belum)
- [ ] Konfigurasi printer thermal (belum)

---

## 🔗 Phase 5 — Backend Integration (Supabase)

- [ ] Setup Supabase project & environment variables
- [ ] Buat schema database PostgreSQL:
  - [ ] Table: outlets, users, products, categories
  - [ ] Table: customers, transactions, transaction_items
  - [ ] Table: stock_movements, employees, shifts
  - [ ] Table: promotions, settings
- [ ] Row Level Security (RLS) policies
- [ ] Supabase Auth — login/register/logout functional
- [ ] Protected routes middleware (next-auth / supabase middleware)
- [ ] CRUD Produk → connect ke Supabase
- [ ] CRUD Kategori → connect ke Supabase
- [ ] Transaksi POS → simpan ke Supabase
- [ ] Stok otomatis berkurang saat transaksi
- [ ] CRUD Pelanggan → connect ke Supabase
- [ ] CRUD Karyawan → connect ke Supabase
- [ ] Laporan → query real dari Supabase
- [ ] Upload foto produk ke Supabase Storage
- [ ] Upload logo toko ke Supabase Storage
- [ ] Realtime stok update (Supabase Realtime)

---

## 🖥️ Phase 6 — Windows Desktop App (Tauri)

- [ ] Setup Tauri v2 di project
- [ ] Bundle Next.js POS sebagai Windows app
- [ ] Mode offline (SQLite lokal) + sync ke Supabase saat online
- [ ] Integrasi printer thermal Windows (ESCPOS)
- [ ] Build installer Windows (.exe / .msi)
- [ ] Code signing untuk installer
- [ ] Auto-update mechanism
- [ ] Shortcut keyboard POS (F1=bayar, F2=diskon, dll)

---

## 🚀 Phase 7 — Polish & Production

- [ ] Push notifikasi stok menipis (email/WhatsApp)
- [ ] Laporan harian otomatis via email
- [ ] UI/UX polish & micro-animations
- [ ] Dark mode toggle
- [ ] Responsive mobile (untuk akses dashboard via HP)
- [ ] Performance optimization (lazy loading, image optimization)
- [ ] Unit testing komponen kritis
- [ ] Integration testing alur POS
- [ ] Error boundary & 404/500 pages
- [ ] Production deployment (Vercel)
- [ ] Custom domain setup
- [ ] SEO & metadata lengkap

---

## 📊 Progress Summary

| Phase | Status | % |
|-------|--------|---|
| Phase 1 — Foundation | ✅ Selesai (sebagian besar) | ~80% |
| Phase 2 — Produk & Inventori | 🟡 Partial | ~60% |
| Phase 3 — POS Kasir | 🟡 Partial | ~65% |
| Phase 4 — Laporan & CRM | 🟡 Partial | ~55% |
| Phase 5 — Backend Supabase | ⭕ Belum dimulai | 0% |
| Phase 6 — Desktop App Tauri | ⭕ Belum dimulai | 0% |
| Phase 7 — Polish & Production | ⭕ Belum dimulai | 0% |

**Total halaman selesai:** 16 halaman ✅ Build sukses
**Next step:** Form dialog tambah/edit produk & pelanggan → lalu Supabase integration
