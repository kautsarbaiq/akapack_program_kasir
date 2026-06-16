import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin workspace root ke folder proyek ini (ada lockfile ganda di home dir
  // yang membuat Turbopack salah menebak root). Menghilangkan warning build.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
