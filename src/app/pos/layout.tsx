import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataBootstrap } from '@/components/data-bootstrap'
import { AuthGuard } from '@/components/auth-guard'
import { PosRoleGuard } from '@/components/pos/pos-role-guard'

export const metadata: Metadata = {
  title: 'POS Kasir | AKAPACK',
}

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <DataBootstrap />
      <PosRoleGuard />
      {/* POS Header */}
      <header className="flex h-14 items-center px-4 shrink-0 gap-3 z-10"
        style={{ background: 'oklch(0.13 0.03 256)', borderBottom: '1px solid oklch(0.22 0.04 256)' }}>
        {/* Tombol kembali ke Dashboard — di KIRI */}
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="text-sm gap-1.5 h-9"
            style={{ color: 'oklch(0.85 0.02 250)' }}>
            <ArrowLeft size={16} /> Dashboard
          </Button>
        </Link>
        <div className="w-px h-6" style={{ background: 'oklch(0.25 0.04 256)' }} />
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm text-white"
            style={{ background: 'oklch(0.55 0.22 264)' }}>
            A
          </div>
          <span className="font-bold text-sm text-white">AKAPACK POS</span>
        </div>
      </header>

      {/* POS Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
    </AuthGuard>
  )
}
