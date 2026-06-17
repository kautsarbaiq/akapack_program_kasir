import type { MetadataRoute } from 'next'

// Web App Manifest — agar "Add to Home Screen" di HP tampil seperti app (fullscreen + ikon + nama).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AKAPACK — POS & Manajemen Bisnis',
    short_name: 'AKAPACK',
    description: 'Kasir, inventori, laporan, dan pelanggan dalam satu aplikasi.',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#4f46e5',
    icons: [
      { src: '/icon-256.png', sizes: '256x256', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
