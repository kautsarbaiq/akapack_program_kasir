import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

// Saat build untuk Tauri (desktop/mobile), set TAURI_BUILD=1 → Next meng-export
// situs statis ke `out/` (tanpa server/middleware). Web biasa tetap SSR seperti semula.
const isTauri = process.env.TAURI_BUILD === "1";

const nextConfig: NextConfig = {
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
