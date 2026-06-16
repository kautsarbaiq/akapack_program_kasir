'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, UserPlus, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'

const registerSchema = z.object({
  full_name: z.string().min(2, 'Nama minimal 2 karakter'),
  business_name: z.string().min(2, 'Nama usaha minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Password tidak sama',
  path: ['confirm_password'],
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })

  const password = watch('password', '')
  const strengthChecks = [
    { label: 'Minimal 8 karakter', valid: password.length >= 8 },
    { label: 'Mengandung huruf besar', valid: /[A-Z]/.test(password) },
    { label: 'Mengandung angka', valid: /[0-9]/.test(password) },
  ]

  const onSubmit = async (data: RegisterForm) => {
    // Mode demo: Supabase belum siap -> langsung masuk
    if (!isSupabaseConfigured()) {
      await new Promise((r) => setTimeout(r, 600))
      toast.success('Akun dibuat (mode demo). Lengkapi Supabase untuk daftar nyata.')
      router.push('/dashboard')
      return
    }
    try {
      const { error } = await getSupabaseBrowser().auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { full_name: data.full_name, business_name: data.business_name } },
      })
      if (error) {
        toast.error(`Pendaftaran gagal: ${error.message}`)
        return
      }
      toast.success('Akun berhasil dibuat! Jika verifikasi email aktif, cek inbox Anda.')
      router.push('/dashboard')
      router.refresh()
    } catch {
      toast.error('Pendaftaran gagal. Coba lagi.')
    }
  }

  return (
    <div className="space-y-7">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Buat Akun AKAPACK</h1>
        <p className="text-muted-foreground text-sm">Mulai kelola bisnis Anda secara profesional</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nama Lengkap *</Label>
            <Input id="full_name" placeholder="John Doe" className="h-10" {...register('full_name')} />
            {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="business_name">Nama Usaha *</Label>
            <Input id="business_name" placeholder="Toko Maju Jaya" className="h-10" {...register('business_name')} />
            {errors.business_name && <p className="text-xs text-destructive">{errors.business_name.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input id="email" type="email" placeholder="nama@email.com" className="h-10" {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password *</Label>
          <div className="relative">
            <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Buat password kuat" className="h-10 pr-10" {...register('password')} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {password && (
            <div className="space-y-1.5 pt-1">
              {strengthChecks.map((c) => (
                <div key={c.label} className="flex items-center gap-2 text-xs">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${c.valid ? 'bg-emerald-500' : 'bg-muted'}`}>
                    {c.valid && <Check size={8} className="text-white" />}
                  </div>
                  <span className={c.valid ? 'text-emerald-600' : 'text-muted-foreground'}>{c.label}</span>
                </div>
              ))}
            </div>
          )}
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm_password">Konfirmasi Password *</Label>
          <div className="relative">
            <Input id="confirm_password" type={showConfirm ? 'text' : 'password'} placeholder="Ulangi password" className="h-10 pr-10" {...register('confirm_password')} />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirm_password && <p className="text-xs text-destructive">{errors.confirm_password.message}</p>}
        </div>

        <p className="text-xs text-muted-foreground">
          Dengan mendaftar, kamu menyetujui{' '}
          <Link href="#" className="underline hover:text-foreground">Syarat & Ketentuan</Link>{' '}
          dan{' '}
          <Link href="#" className="underline hover:text-foreground">Kebijakan Privasi</Link> AKAPACK.
        </p>

        <Button type="submit" className="w-full h-11 font-semibold gap-2" disabled={isSubmitting}
          style={{ background: 'oklch(0.55 0.22 264)' }}>
          {isSubmitting ? <><Loader2 size={16} className="animate-spin" />Memproses...</> : <><UserPlus size={16} />Daftar Sekarang</>}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Sudah punya akun?{' '}
        <Link href="/login" className="font-semibold hover:underline" style={{ color: 'oklch(0.55 0.22 264)' }}>Masuk</Link>
      </p>
    </div>
  )
}
