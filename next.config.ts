import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

// Saat build untuk Tauri (desktop/mobile), set TAURI_BUILD=1 → Next meng-export
// situs statis ke `out/` (tanpa server/middleware). Web biasa tetap SSR seperti semula.
const isTauri = process.env.TAURI_BUILD === "1";

// Id build (commit di Vercel) — ditanam ke klien & disajikan /api/version, supaya tab yang lama terbuka
// tahu ada versi baru (perbaikan stok/riwayat hanya berlaku setelah halaman dimuat ulang).
const buildId = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || `local-${Date.now()}`

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  // Pin workspace root ke folder proyek ini (ada lockfile ganda di home dir
  // yang membuat Turbopack salah menebak root). Menghilangkan warning build.
  turbopack: {
    root: projectRoot,
  },
  ...(isTauri
    ? {
        output: "export" as const,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
