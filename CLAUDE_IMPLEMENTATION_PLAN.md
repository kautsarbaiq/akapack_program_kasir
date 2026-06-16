# 🚀 AKAPACK — Implementation Plan (FINAL & APPROVED)
## Platform POS & Manajemen Retail Internal Perusahaan

> **Status:** ✅ APPROVED — Siap Eksekusi
> **Brand:** AKAPACK | **Segmen:** Retail | **Tujuan:** Internal perusahaan
> **Tanggal:** Juni 2026

---

## 🎯 KEPUTUSAN FINAL

| Aspek | Keputusan |
|-------|-----------|
| **Nama Brand** | **AKAPACK** |
| **Tujuan** | Internal perusahaan (bukan dijual) |
| **Segmen** | Retail (toko, minimarket, dll) |
| **Platform** | Web Dashboard + POS Web + POS Windows App |
| **Scope** | Bertahap — mulai MVP, lanjut sesuai kebutuhan |
| **Target** | UMKM Lokal Indonesia |

> 💡 *Catatan: Ide untuk menjual platform di masa depan disimpan untuk rencana jangka panjang*

---

## 🛠️ TECH STACK PILIHAN TERBAIK

> **Filosofi:** Stack modern yang optimal untuk vibe coding — cepat develop, mudah maintain, production-ready.

### Frontend — Web App (Dashboard + POS Web)
| Teknologi | Versi | Alasan |
|-----------|-------|--------|
| **Next.js** | 15 (App Router) | Full-stack framework terbaik, SSR/SSG, API routes built-in |
| **TypeScript** | 5.x | Type safety, less bugs, better DX |
| **Tailwind CSS** | v4 | Utility-first, rapid UI development |
| **shadcn/ui** | Latest | Komponen UI premium, copy-paste ready, accessible |
| **Lucide React** | Latest | Icon library modern & konsisten |
| **Framer Motion** | Latest | Animasi smooth & premium |

### Backend & Database
| Teknologi | Alasan |
|-----------|--------|
| **Supabase** | PostgreSQL + Auth + Storage + Realtime — semua dalam satu platform, zero-config backend |
| **PostgreSQL** | Database relasional robust (via Supabase) |
| **Supabase Auth** | Authentication siap pakai (email, magic link, OAuth) |
| **Supabase Storage** | File storage untuk foto produk, struk, dll |
| **Supabase Realtime** | Live updates (stok, notifikasi, KDS) |

### State Management & Data Fetching
| Teknologi | Alasan |
|-----------|--------|
| **TanStack Query (React Query)** | Server state management, caching, sync |
| **Zustand** | Client state management, ringan & simpel |
| **Supabase JS Client** | SDK official untuk query database |

### Windows POS App
| Teknologi | Alasan |
|-----------|--------|
| **Tauri v2** | Wrapper app ringan (10x lebih ringan dari Electron), menggunakan web tech yang sama |
| **Offline Storage** | SQLite via Tauri + sync ke Supabase saat online |

### Charting & Visualisasi
| Teknologi | Alasan |
|-----------|--------|
| **Recharts** | Chart library berbasis React, terintegrasi dengan shadcn/charts |
| **shadcn/charts** | Pre-built chart components premium |

### Tools & DX
| Teknologi | Alasan |
|-----------|--------|
| **pnpm** | Package manager tercepat |
| **ESLint + Prettier** | Code quality & formatting |
| **Husky** | Git hooks (pre-commit checks) |

### Stack Architecture Visual
```
┌─────────────────────────────────────────────┐
│          AKAPACK PLATFORM                   │
├─────────────────────┬───────────────────────┤
│   Next.js 15 App    │    Tauri Windows App  │
│   (Web Dashboard    │    (POS Kasir         │
│    + POS Web)       │     Desktop)          │
├─────────────────────┴───────────────────────┤
│              Supabase Backend               │
│  PostgreSQL │ Auth │ Storage │ Realtime     │
└─────────────────────────────────────────────┘
```

---

## 📦 MODUL YANG DIBANGUN (Retail Focus)

### ✅ Masuk MVP (Phase 1-2):
1. **POS Kasir** — Web + Windows Desktop
2. **Manajemen Produk & Inventori** — Katalog, stok, kategori
3. **Dashboard Back-Office** — KPI, grafik, monitoring
4. **Manajemen Pelanggan** — Database, member, poin
5. **Laporan & Analitik** — Penjualan, stok, keuangan
6. **Manajemen Karyawan** — Role, hak akses, shift
7. **Promosi & Voucher** — Diskon, promo code

### 🔮 Phase 3+ (Masa Depan):
8. Multi-outlet management
9. Purchase Order & Supplier
10. Program Loyalitas Lengkap
11. Toko Online / Katalog Web
12. Integrasi Marketplace (jika diperlukan)
13. Akuntansi Terintegrasi

---

## 🗂️ STRUKTUR PROYEK

```
/Users/macbookpro/Documents/akapack/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/             # Login, register, reset password
│   │   ├── (dashboard)/        # Back-office dashboard
│   │   │   ├── page.tsx        # Dashboard home / KPI
│   │   │   ├── produk/         # Manajemen produk
│   │   │   ├── inventori/      # Manajemen stok
│   │   │   ├── penjualan/      # Laporan & transaksi
│   │   │   ├── pelanggan/      # CRM pelanggan
│   │   │   ├── karyawan/       # Manajemen SDM
│   │   │   ├── promosi/        # Diskon & voucher
│   │   │   └── pengaturan/     # Settings
│   │   ├── pos/                # POS Kasir (web)
│   │   └── api/                # API routes (jika perlu)
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── dashboard/          # Dashboard-specific components
│   │   ├── pos/                # POS-specific components
│   │   └── shared/             # Shared components
│   ├── lib/
│   │   ├── supabase/           # Supabase client & helpers
│   │   ├── utils/              # Utility functions
│   │   └── validations/        # Zod schemas
│   ├── hooks/                  # Custom React hooks
│   ├── stores/                 # Zustand stores
│   └── types/                  # TypeScript types
├── supabase/
│   ├── migrations/             # Database schema migrations
│   └── seed.sql               # Seed data
├── src-tauri/                  # Tauri Windows app config
├── public/                     # Static assets
├── package.json
├── tailwind.config.ts
├── next.config.ts
└── tsconfig.json
```

---

## 🗄️ DATABASE SCHEMA (PostgreSQL via Supabase)

```sql
-- Core Tables:
users            -- Auth users (Supabase Auth)
outlets          -- Cabang/toko
products         -- Katalog produk
categories       -- Kategori produk
product_variants -- Varian produk (ukuran, warna)
inventory        -- Stok per produk per outlet
transactions     -- Header transaksi penjualan
transaction_items-- Detail item per transaksi
customers        -- Database pelanggan
employees        -- Data karyawan
shifts           -- Shift kasir
promotions       -- Promosi & diskon
vouchers         -- Voucher kode
loyalty_points   -- Poin reward pelanggan
```

---

## 🚀 ROADMAP EKSEKUSI

### ⚡ Phase 1 — Foundation (Minggu 1-3)
- [ ] Setup proyek Next.js 15 + Tailwind + shadcn/ui
- [ ] Konfigurasi Supabase (DB, Auth, Storage)
- [ ] Database schema & migrations
- [ ] Sistem Auth (login, register, reset password)
- [ ] Layout dashboard back-office
- [ ] Dashboard home (KPI cards, grafik ringkasan)

### 🏪 Phase 2 — Produk & Inventori (Minggu 3-5)
- [ ] Manajemen Produk (CRUD, kategori, varian, foto)
- [ ] Import/export Excel
- [ ] Manajemen Stok (stok masuk, opname, alert)
- [ ] Barcode scanner support

### 💳 Phase 3 — POS Kasir Web (Minggu 5-7)
- [ ] UI kasir (product grid, cart, payment)
- [ ] Multi-metode bayar (cash, QRIS, e-wallet)
- [ ] Manajemen shift kasir
- [ ] Cetak struk (thermal printer)
- [ ] Refund & void transaksi

### 📊 Phase 4 — Laporan & CRM (Minggu 7-9)
- [ ] Dashboard laporan penjualan (20+ jenis)
- [ ] Database pelanggan & member
- [ ] Program loyalitas & poin
- [ ] Promosi, diskon & voucher
- [ ] Export Excel & PDF

### 🖥️ Phase 5 — Windows App (Minggu 9-11)
- [ ] Setup Tauri v2
- [ ] POS Windows Desktop App
- [ ] Mode offline + sync ke Supabase
- [ ] Printer integration Windows
- [ ] Build & installer (.exe)

### 👥 Phase 6 — Karyawan & Polish (Minggu 11-13)
- [ ] Manajemen Karyawan & hak akses
- [ ] Sistem shift & absensi
- [ ] Notifikasi (stok menipis, dll)
- [ ] UI/UX polish & responsive
- [ ] Performance optimization
- [ ] Testing & deployment

---

## 🎨 DESIGN SYSTEM AKAPACK

- **Warna Utama:** Deep Navy Blue `#1E2B4A` + Electric Blue `#2563EB`
- **Warna Aksen:** Emerald Green `#10B981` (sukses), Amber `#F59E0B` (peringatan)
- **Font:** Inter (heading) + Inter (body) — clean, professional
- **Mode:** Dark sidebar + Light content area
- **Style:** Modern, professional, premium — cocok untuk bisnis

---

*Plan ini sudah FINAL dan APPROVED — Siap untuk eksekusi development AKAPACK!*
