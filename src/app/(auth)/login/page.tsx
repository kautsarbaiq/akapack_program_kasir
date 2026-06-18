'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, LogIn, Mail, IdCard } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { useEmployeeStore } from '@/stores/use-employee-store'
import { useCurrentUserStore, clearStaffSession } from '@/stores/use-current-user-store'

const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
})
type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'owner' | 'staff'>('owner')
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  // ── Login owner (email + password) ──
  const onSubmit = async (data: LoginForm) => {
    if (!isSupabaseConfigured()) {
      await new Promise((r) => setTimeout(r, 500))
      clearStaffSession()
      toast.success('Masuk (mode demo).')
      router.push('/dashboard'); return
    }
    try {
      const { error } = await getSupabaseBrowser().auth.signInWithPassword({ email: data.email, password: data.password })
      if (error) { toast.error(`Login gagal: ${error.message}`); return }
      clearStaffSession() // pastikan tak ada sesi karyawan tersisa
      toast.success('Login berhasil! Selamat datang.')
      router.push('/dashboard'); router.refresh()
    } catch {
      toast.error('Login gagal. Periksa email dan password Anda.')
    }
  }

  // ── Login karyawan (nama + PIN) ──
  const employees = useEmployeeStore((s) => s.employees)
  const fetchEmployees = useEmployeeStore((s) => s.fetch)
  const staffLogin = useCurrentUserStore((s) => s.staffLogin)
  const [staffName, setStaffName] = useState('')
  const [staffPin, setStaffPin] = useState('')
  const [staffBusy, setStaffBusy] = useState(false)

  useEffect(() => { if (mode === 'staff' && employees.length === 0) void fetchEmployees() }, [mode, employees.length, fetchEmployees])
  const staffOptions = employees.filter((e) => e.is_active && e.role !== 'owner')

  const onStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStaffBusy(true)
    const err = await staffLogin(staffName, staffPin)
    setStaffBusy(false)
    if (err) { toast.error(err); return }
    toast.success(`Selamat datang, ${staffName}!`)
    router.push('/pos'); router.refresh()
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Selamat Datang</h1>
        <p className="text-muted-foreground">Masuk ke AKAPACK</p>
      </div>

      {/* Pilih jenis login */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted">
        <button type="button" onClick={() => setMode('owner')}
          className={cn('flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors',
            mode === 'owner' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground')}>
          <Mail size={15} /> Owner
        </button>
        <button type="button" onClick={() => setMode('staff')}
          className={cn('flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors',
            mode === 'staff' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground')}>
          <IdCard size={15} /> Karyawan
        </button>
      </div>

      {mode === 'owner' ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="nama@email.com" autoComplete="email" className="h-11" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-sm font-medium hover:underline" style={{ color: 'oklch(0.55 0.22 264)' }}>Lupa password?</Link>
            </div>
            <div className="relative">
              <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Masukkan password" autoComplete="current-password" className="h-11 pr-11" {...register('password')} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full h-11 font-semibold text-base gap-2" disabled={isSubmitting} style={{ background: 'oklch(0.55 0.22 264)' }}>
            {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Memproses...</> : <><LogIn size={18} /> Masuk sebagai Owner</>}
          </Button>
        </form>
      ) : (
        <form onSubmit={onStaffSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="staff-name">Nama Karyawan</Label>
            <select id="staff-name" value={staffName} onChange={(e) => setStaffName(e.target.value)}
              className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">-- Pilih nama --</option>
              {staffOptions.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
            {staffOptions.length === 0 && <p className="text-xs text-muted-foreground">Memuat daftar karyawan…</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-pin">PIN Absensi</Label>
            <Input id="staff-pin" type="password" inputMode="numeric" placeholder="Masukkan PIN" autoComplete="off"
              className="h-11 tracking-widest" value={staffPin} onChange={(e) => setStaffPin(e.target.value)} />
          </div>
          <Button type="submit" className="w-full h-11 font-semibold text-base gap-2" disabled={staffBusy || !staffName || !staffPin} style={{ background: 'oklch(0.55 0.22 264)' }}>
            {staffBusy ? <><Loader2 size={18} className="animate-spin" /> Memproses...</> : <><LogIn size={18} /> Masuk</>}
          </Button>
          <p className="text-xs text-muted-foreground text-center">Karyawan masuk pakai nama & PIN absensi dari owner.</p>
        </form>
      )}

      {mode === 'owner' && (
        <>
          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">Belum punya akun?</span>
          </div>
          <div className="text-center">
            <Link href="/register" className="text-sm font-semibold hover:underline" style={{ color: 'oklch(0.55 0.22 264)' }}>Daftar sekarang — Gratis</Link>
          </div>
        </>
      )}
    </div>
  )
}
