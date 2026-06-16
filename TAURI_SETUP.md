# 🖥️📱 AKAPACK — Bungkus ke Windows, macOS & Mobile (Tauri v2)

AKAPACK dibungkus **satu basis kode** (Next.js) ke aplikasi native lewat **Tauri v2**:
desktop (Windows/macOS/Linux) dan mobile (Android/iOS). Frontend yang sama dipakai ulang.

> **Penting (batasan):** installer **Windows (.exe/.msi) tidak bisa di-build dari Mac** — harus
> di mesin Windows **atau** via **GitHub Actions** (sudah disiapkan, lihat bawah). Build native
> juga butuh **Rust** (belum terpasang di mesin ini).

---

## 0. Yang sudah disiapkan di repo

- `src-tauri/` — proyek Tauri v2 (config, entry Rust desktop+mobile, capabilities).
- `next.config.ts` — mode **static export** otomatis saat `TAURI_BUILD=1` (web biasa tetap SSR).
- `scripts/tauri-export.mjs` — export Next ke `out/` (menyingkirkan middleware sementara).
- `src/components/auth-guard.tsx` — proteksi login sisi-klien (pengganti `proxy.ts` di app bundel).
- `.github/workflows/tauri.yml` — CI build installer Windows + macOS + Linux.
- Script npm: `tauri:dev`, `tauri:build`, `tauri:export`, `tauri:android`, `tauri:ios`.

---

## 1. Prasyarat (sekali saja)

> ⚠️ **Jalankan perintah SATU baris per satu.** Jangan tempel komentar (`# ...`) ke
> terminal — zsh tidak menganggapnya komentar dan akan error (`unknown file attribute`).

### a. Rust
```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```
Buka terminal **baru**, lalu cek:
```
rustc --version
```

### b. Tauri CLI — lewat Cargo (BUKAN npm)
npm versi ini punya bug saat memasang paket biner `@tauri-apps/cli`. Pakai Cargo (Rust sudah ada):
```
cargo install tauri-cli --version "^2.0.0" --locked
```
Cek:
```
cargo tauri --version
```

### c. Dependensi JS — TIDAK perlu `npm install`
`node_modules` di mesin ini sudah lengkap (web app sudah jalan) dan frontend tidak mengimpor
paket npm Tauri apa pun. **Lewati `npm install`.** (Untuk clone baru / CI lihat §6 Catatan npm.)

### d. Ikon aplikasi (ganti dengan path logo aslimu)
```
npm run tauri icon /Users/macbookpro/Documents/akapack/logo.png
```

---

## 2. Jalankan sebagai app DESKTOP (di Mac ini)

```bash
npm run tauri:dev
```
Tauri otomatis menjalankan `next dev` lalu membuka AKAPACK di jendela native (auth & semua
fitur jalan normal karena memakai dev server). Build installer macOS:
```bash
npm run tauri:build      # hasil: src-tauri/target/release/bundle/{dmg,macos}/
```

---

## 3. Installer WINDOWS (.exe / .msi)

Tidak bisa dari Mac. Dua cara:

**A. Lewat GitHub Actions (disarankan).**
1. Push repo ke GitHub.
2. Tambahkan secret di **Settings → Secrets and variables → Actions**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Buka tab **Actions → Build AKAPACK (Tauri) → Run workflow** (atau `git tag v0.1.0 && git push --tags`).
4. Selesai build, installer Windows/macOS/Linux muncul sebagai **draft Release** untuk diunduh.

**B. Di mesin Windows.** Install Rust + [Visual Studio C++ Build Tools] + WebView2, lalu `npm install` & `npm run tauri:build`.

---

## 4. Aplikasi MOBILE (Android / iOS)

### Android (butuh Android Studio + SDK/NDK + JDK 17)
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export NDK_HOME=$ANDROID_HOME/ndk/<versi>
npm run tauri android init     # sekali
npm run tauri:android          # jalankan di emulator/HP
npm run tauri android build    # hasil .apk/.aab
```

### iOS (butuh macOS + Xcode — cocok karena kamu di Mac)
```bash
xcode-select --install
npm run tauri ios init         # sekali
npm run tauri:ios              # jalankan di simulator/iPhone
npm run tauri ios build        # hasil .ipa (butuh akun Apple Developer untuk distribusi)
```

> Catatan: di mobile, `proxy.ts` tidak berlaku — proteksi login ditangani `AuthGuard`.
> Supabase tetap diakses langsung lewat internet (belum ada mode offline; itu fase lanjutan).

---

## 5. Cara kerja build (ringkas)

| Mode | Perintah | Frontend |
|------|----------|----------|
| Dev desktop/mobile | `tauri:dev` / `tauri:android` / `tauri:ios` | `next dev` (devUrl `localhost:3000`) |
| Produksi (bundel) | `tauri:build` | `out/` hasil `tauri:export` (static export) |
| Web (Vercel dll) | `npm run build` | SSR + middleware seperti biasa (tak terpengaruh) |

Saat export, Next berjalan dengan `output: 'export'`; `proxy.ts` disingkirkan sementara oleh
`scripts/tauri-export.mjs` karena static export tidak mengizinkan middleware.

---

## 6. Catatan instalasi dependency (PENTING)

npm **10 maupun 11** sama-sama **crash** saat me-resolve dependency tree proyek ini dari nol
(bug internal npm/arborist: null `matches` / `isDescendantOf` / `name`). Ini **bukan** paket yang
rusak — terbukti **pnpm me-resolve bersih** (753 paket OK). Jadi untuk memasang dependency, pakai **pnpm**.

- **Di mesin ini:** `node_modules` sudah lengkap → **JANGAN `npm install`**.
  `npm run dev`, `npm run tauri:dev`, dll tetap jalan (hanya menjalankan script atas node_modules yang ada).
- **Clone baru / mesin lain / CI:** pakai pnpm (Node ≥20 sudah punya corepack):
  ```
  corepack enable
  ```
  ```
  pnpm install
  ```
- Sudah ada `pnpm-lock.yaml` di repo (hasil resolve). Commit supaya install deterministik di mana saja.
- **CI** (`.github/workflows/tauri.yml`) sudah memakai pnpm.
- **Tauri CLI** lewat Cargo (`cargo install tauri-cli`), bukan npm.

