'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  email: z.string().email('Email tidak valid'),
})
type Form = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: Form) => {
    await new Promise((r) => setTimeout(r, 1200))
    setSentEmail(data.email)
    setSent(true)
    toast.success('Link reset password telah dikirim!')
  }

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'oklch(0.65 0.18 160 / 0.15)' }}>
          <CheckCircle2 size={32} style={{ color: 'oklch(0.55 0.18 160)' }} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Email Terkirim!</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Kami telah mengirim link reset password ke<br />
            <span className="font-semibold text-foreground">{sentEmail}</span>
          </p>
          <p className="text-xs text-muted-foreground">Cek inbox atau folder spam Anda</p>
        </div>
        <Link href="/login">
          <Button variant="outline" className="gap-2 w-full">
            <ArrowLeft size={16} /> Kembali ke Login
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'oklch(0.55 0.22 264 / 0.1)' }}>
          <Mail size={24} style={{ color: 'oklch(0.55 0.22 264)' }} />
        </div>
        <h1 className="text-3xl font-bold">Lupa Password?</h1>
        <p className="text-muted-foreground text-sm">Masukkan email Anda dan kami akan kirim link untuk reset password.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Alamat Email</Label>
          <Input id="email" type="email" placeholder="nama@email.com" className="h-11" {...register('email')} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <Button type="submit" className="w-full h-11 font-semibold gap-2" disabled={isSubmitting}
          style={{ background: 'oklch(0.55 0.22 264)' }}>
          {isSubmitting ? <><Loader2 size={16} className="animate-spin" />Mengirim...</> : <><Mail size={16} />Kirim Link Reset</>}
        </Button>
      </form>

      <div className="text-center">
        <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
          <ArrowLeft size={14} /> Kembali ke Login
        </Link>
      </div>
    </div>
  )
}
