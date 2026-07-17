'use client'

import { useState } from 'react'
import { KeyRound, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { useCurrentUserStore } from '@/stores/use-current-user-store'
import { toast } from 'sonner'

/**
 * Ganti password akun owner — pakai SESI yang sedang login (supabase.auth.updateUser).
 * TIDAK butuh email/SMTP, jadi jalan walau proyek Supabase belum setel email.
 * Hanya untuk login owner (email); karyawan login pakai PIN, bukan password.
 */
export function ChangePasswordCard() {
  const me = useCurrentUserStore((s) => s.user)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  // Karyawan (login PIN) tak punya password Supabase — sembunyikan.
  if (!me || me.viaStaff || !me.email) return null

  const submit = async () => {
    if (pw.length < 6) { toast.error('Password minimal 6 karakter'); return }
    if (pw !== pw2) { toast.error('Konfirmasi password tidak sama'); return }
    if (!isSupabaseConfigured()) { toast.error('Supabase belum dikonfigurasi'); return }
    setBusy(true)
    try {
      const { error } = await getSupabaseBrowser().auth.updateUser({ password: pw })
      if (error) { toast.error(`Gagal ganti password: ${error.message}`); return }
      toast.success('Password berhasil diganti. Pakai password baru saat login berikutnya.')
      setPw(''); setPw2('')
    } catch {
      toast.error('Gagal ganti password. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><KeyRound size={17} /> Ganti Password Owner</CardTitle>
        <CardDescription>Akun <span className="font-medium">{me.email}</span>. Berlaku langsung tanpa email verifikasi.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-sm">
        <div className="space-y-2">
          <Label>Password Baru</Label>
          <div className="relative">
            <Input type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="min. 6 karakter" className="pr-10" autoComplete="new-password" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Ulangi Password Baru</Label>
          <Input type={show ? 'text' : 'password'} value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="ketik ulang" autoComplete="new-password" />
        </div>
        <Button onClick={submit} disabled={busy || !pw || !pw2} className="gap-2">
          {busy ? <><Loader2 size={16} className="animate-spin" /> Menyimpan…</> : <><KeyRound size={16} /> Simpan Password Baru</>}
        </Button>
      </CardContent>
    </Card>
  )
}
