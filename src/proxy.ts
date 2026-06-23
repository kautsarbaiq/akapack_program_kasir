import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from '@/lib/supabase/config'

const MAINTENANCE_ON = ['1', 'true', 'on', 'yes'].includes((process.env.MAINTENANCE_MODE || '').trim().toLowerCase())

// Next.js 16: konvensi "proxy" (pengganti "middleware").
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  // ── MODE MAINTENANCE (dikontrol env MAINTENANCE_MODE di hosting) ──
  // Saat aktif, semua pengunjung diarahkan ke halaman "Sedang Maintenance".
  // Owner (punya cookie peran 'owner') TETAP bisa masuk untuk mengelola. Halaman login & /maintenance
  // tetap terbuka agar owner bisa login dulu. Aset Next & API dibiarkan lewat agar halaman tampil benar.
  if (MAINTENANCE_ON) {
    const role = (request.cookies.get('akapack-role')?.value || '').toLowerCase()
    const exempt =
      path === '/maintenance' ||
      path.startsWith('/login') ||
      path.startsWith('/api') ||
      path.startsWith('/auth') ||
      path.startsWith('/_next') ||
      path === '/favicon.ico' ||
      /\.(?:png|jpg|jpeg|gif|svg|webp|ico|webmanifest|woff2?)$/i.test(path)
    if (role !== 'owner' && !exempt) {
      return NextResponse.rewrite(new URL('/maintenance', request.url))
    }
  }

  // Config-gated: kalau Supabase belum siap, jangan kunci apa pun (app tetap bisa dipakai).
  if (!isSupabaseConfigured()) return NextResponse.next()

  // Auth & role-gating HANYA untuk rute terproteksi. Rute publik (landing, login, maintenance)
  // lewat tanpa query Supabase → lebih ringan walau middleware kini jalan di semua rute.
  const isProtected = path.startsWith('/dashboard') || path.startsWith('/pos')
  if (!isProtected) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  // Karyawan login via nama+PIN (sesi klien) menaruh cookie penanda — izinkan masuk.
  const hasStaff = request.cookies.get('akapack-staff')?.value === '1'

  if (!user && !hasStaff) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Pertahanan SERVER-side: rute sensitif (akuntansi/laba-modal, pengaturan, kelola outlet/karyawan,
  // promosi, pelanggan) hanya untuk owner. Cegah kasir/manager membukanya via URL langsung — jangan
  // hanya andalkan guard di klien. Cookie peran ditulis saat login/fetch (fail-open bila belum ada,
  // klien tetap menjaga). Absensi tetap boleh untuk semua role.
  const role = (request.cookies.get('akapack-role')?.value || '').toLowerCase()
  if ((user || hasStaff) && role && role !== 'owner') {
    const ownerOnly =
      path.startsWith('/dashboard/akuntansi') ||
      path.startsWith('/dashboard/pengaturan') ||
      path.startsWith('/dashboard/outlet') ||
      path.startsWith('/dashboard/promosi') ||
      path.startsWith('/dashboard/pelanggan') ||
      (path.startsWith('/dashboard/karyawan') && !path.startsWith('/dashboard/karyawan/absensi'))
    if (ownerOnly) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  // Jalan di semua rute (agar maintenance bisa menutup seluruh domain), kecuali aset internal Next.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
