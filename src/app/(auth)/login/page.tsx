'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'


const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: LoginForm) => {
    try {
      // Simulasi login — akan diganti dengan Supabase Auth
      await new Promise((resolve) => setTimeout(resolve, 1200))
      
      if (data.email && data.password) {
        toast.success('Login berhasil! Selamat datang di AKAPACK.')
        router.push('/dashboard')
      }
    } catch {
      toast.error('Login gagal. Periksa email dan password Anda.')
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Selamat Datang Kembali
        </h1>
        <p className="text-muted-foreground">
          Masuk ke dashboard AKAPACK Anda
        </p>
      </div>

      {/* Demo credentials box */}
      <div className="rounded-xl p-4 text-sm space-y-1"
        style={{ background: 'oklch(0.55 0.22 264 / 0.08)', border: '1px solid oklch(0.55 0.22 264 / 0.2)' }}>
        <p className="font-semibold" style={{ color: 'oklch(0.55 0.22 264)' }}>Demo Akses</p>
        <p className="text-muted-foreground">Email: <span className="font-mono text-foreground">demo@akapack.com</span></p>
        <p className="text-muted-foreground">Password: <span className="font-mono text-foreground">demo123</span></p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="nama@email.com"
            autoComplete="email"
            className="h-11"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password"
              className="text-sm font-medium hover:underline"
              style={{ color: 'oklch(0.55 0.22 264)' }}>
              Lupa password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Masukkan password"
              autoComplete="current-password"
              className="h-11 pr-11"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full h-11 font-semibold text-base gap-2"
          disabled={isSubmitting}
          style={{ background: 'oklch(0.55 0.22 264)' }}>
          {isSubmitting ? (
            <><Loader2 size={18} className="animate-spin" /> Memproses...</>
          ) : (
            <><LogIn size={18} /> Masuk</>
          )}
        </Button>
      </form>

      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
          Belum punya akun?
        </span>
      </div>

      <div className="text-center">
        <Link href="/register"
          className="text-sm font-semibold hover:underline"
          style={{ color: 'oklch(0.55 0.22 264)' }}>
          Daftar sekarang — Gratis
        </Link>
      </div>
    </div>
  )
}
