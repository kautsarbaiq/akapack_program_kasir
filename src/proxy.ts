import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from '@/lib/supabase/config'

// Next.js 16: konvensi "proxy" (pengganti "middleware").
export async function proxy(request: NextRequest) {
  // Config-gated: kalau Supabase belum siap, jangan kunci apa pun (app tetap bisa dipakai).
  if (!isSupabaseConfigured()) return NextResponse.next()

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
  const path = request.nextUrl.pathname
  const isProtected = path.startsWith('/dashboard') || path.startsWith('/pos')
  // Karyawan login via nama+PIN (sesi klien) menaruh cookie penanda — izinkan masuk.
  const hasStaff = request.cookies.get('akapack-staff')?.value === '1'

  if (!user && !hasStaff && isProtected) {
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
  matcher: ['/dashboard/:path*', '/pos/:path*'],
}
