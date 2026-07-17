import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from '@/lib/supabase/config'

// KUNCI KERAS khusus developer: set env MAINTENANCE_MODE=1 di hosting (Vercel) → kunci TOTAL, owner pun
// tak bisa masuk & tak ada tombol in-app yang bisa mematikannya. Hanya developer (pemegang akses hosting)
// yang bisa nyalakan/matikan. Beda dari flag DB app_config (lembut, owner tetap masuk, di-toggle Pengaturan).
const MAINTENANCE_ENV = ['1', 'true', 'on', 'yes'].includes((process.env.MAINTENANCE_MODE || '').trim().toLowerCase())

// Flag maintenance dari Supabase (bisa di-toggle 1 klik dari halaman Pengaturan, tanpa redeploy).
// Di-cache ~15 dtk agar tak query tiap request, dan FAIL-OPEN (kalau gagal → anggap mati) supaya
// hiccup DB tak pernah mengunci seluruh web.
let maintCache: { on: boolean; ts: number } = { on: false, ts: 0 }
async function maintenanceFromDB(): Promise<boolean> {
  const now = Date.now()
  if (now - maintCache.ts < 15000) return maintCache.on
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_config?id=eq.1&select=maintenance_mode`, {
      headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      // Gagal (mis. tabel app_config belum dimigrasi → 404) juga DICATAT ke cache —
      // tanpa ini tiap request bayar round-trip DB selama tabel belum ada.
      maintCache = { on: maintCache.on, ts: now }
      return maintCache.on
    }
    const rows = (await res.json()) as Array<{ maintenance_mode?: boolean }>
    const on = Array.isArray(rows) && rows[0]?.maintenance_mode === true
    maintCache = { on, ts: now }
    return on
  } catch {
    maintCache = { on: maintCache.on, ts: now } // fail-open + throttle: nilai terakhir dipertahankan
    return maintCache.on
  }
}

// Next.js 16: konvensi "proxy" (pengganti "middleware").
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const supaOk = isSupabaseConfigured()

  // ── MODE MAINTENANCE — DUA TINGKAT ──
  // Path teknis yang HARUS tetap lolos agar halaman /maintenance sendiri bisa dirender (aset Next + ikon).
  const maintExemptHard =
    path === '/maintenance' ||
    path.startsWith('/_next') ||
    path === '/favicon.ico' ||
    /\.(?:png|jpg|jpeg|gif|svg|webp|ico|webmanifest|woff2?)$/i.test(path)

  if (MAINTENANCE_ENV) {
    // KERAS (khusus DEVELOPER via env MAINTENANCE_MODE di hosting/Vercel): SEMUA diblokir — termasuk
    // owner. Tak ada bypass cookie, tak bisa dimatikan dari dalam app; hanya developer yang bisa
    // mematikan dengan menghapus env var. Login pun ikut ditutup → benar-benar terkunci total.
    if (!maintExemptHard) return NextResponse.rewrite(new URL('/maintenance', request.url))
  } else if (supaOk) {
    // LEMBUT (flag app_config, di-toggle owner dari Pengaturan): owner TETAP bisa masuk untuk mengelola;
    // login/api/auth tetap terbuka. Sisanya diarahkan ke halaman maintenance.
    const maintExemptSoft = maintExemptHard || path.startsWith('/login') || path.startsWith('/api') || path.startsWith('/auth')
    const roleCookie = (request.cookies.get('akapack-role')?.value || '').toLowerCase()
    if (!maintExemptSoft && roleCookie !== 'owner' && await maintenanceFromDB()) {
      return NextResponse.rewrite(new URL('/maintenance', request.url))
    }
  }

  // Config-gated: kalau Supabase belum siap, jangan kunci apa pun (app tetap bisa dipakai).
  if (!supaOk) return NextResponse.next()

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
    // Tujuan redirect sesuai peran (hindari bounce ke halaman yang role itu tak boleh).
    const landing = role === 'sales' ? '/dashboard/surat-pesanan'
      : role === 'cashier' ? '/dashboard/karyawan/absensi'
      : '/dashboard'
    const redirectTo = (p: string) => { const url = request.nextUrl.clone(); url.pathname = p; return NextResponse.redirect(url) }

    const ownerOnly =
      path.startsWith('/dashboard/akuntansi') ||
      path.startsWith('/dashboard/pengaturan') ||
      path.startsWith('/dashboard/outlet') ||
      path.startsWith('/dashboard/promosi') ||
      path.startsWith('/dashboard/pelanggan') ||
      (path.startsWith('/dashboard/karyawan') && !path.startsWith('/dashboard/karyawan/absensi'))
    if (ownerOnly) return redirectTo(landing)

    // MANAGER: dilarang lihat omzet/laba/per-kasir → tutup Laporan Penjualan & Riwayat Transaksi
    // di server (kasir tetap boleh Riwayat, makanya blok ini khusus manager). Laporan hub juga.
    if (role === 'manager' && (path.startsWith('/dashboard/penjualan') || path.startsWith('/dashboard/laporan'))) {
      return redirectTo('/dashboard')
    }

    // SALES: dikunci ke Surat Pesanan + Absensi. Dilarang POS & halaman dashboard lain (server-side).
    if (role === 'sales') {
      const salesOk = path === '/dashboard'
        || path.startsWith('/dashboard/surat-pesanan')
        || path.startsWith('/dashboard/penawaran')
        || path.startsWith('/dashboard/karyawan/absensi')
      if (path.startsWith('/pos') || (path.startsWith('/dashboard') && !salesOk)) return redirectTo('/dashboard/surat-pesanan')
    }
  }

  return response
}

export const config = {
  // Jalan di semua rute (agar maintenance bisa menutup seluruh domain), kecuali aset internal Next.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
