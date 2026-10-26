// Versi build yang sedang disajikan server. Dibuat STATIS saat build (force-static) → tiap deployment
// menyajikan id-nya sendiri, dan tetap kompatibel dengan ekspor statis Tauri.
// Dipakai UpdateBanner: tab kasir yang terbuka berhari-hari tahu bahwa ada versi baru.
export const dynamic = 'force-static'

export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev' })
}
