import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'POS Kasir | AKAPACK',
}

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* POS Header */}
      <header className="flex h-14 items-center px-4 shrink-0 gap-4 z-10"
        style={{ background: 'oklch(0.13 0.03 256)', borderBottom: '1px solid oklch(0.22 0.04 256)' }}>
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm text-white"
            style={{ background: 'oklch(0.55 0.22 264)' }}>
            A
          </div>
          <span className="font-bold text-sm text-white">AKAPACK POS</span>
        </div>

        <div className="h-5 w-px mx-2" style={{ background: 'oklch(0.3 0.04 256)' }} />

        {/* Shift info */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium" style={{ color: 'oklch(0.7 0.02 250)' }}>Shift Aktif · Riko Andrian</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-8"
              style={{ color: 'oklch(0.65 0.02 250)' }}>
              <ArrowLeft size={14} /> Dashboard
            </Button>
          </Link>
          <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-8 text-red-400 hover:text-red-300">
            <Power size={14} /> Tutup Shift
          </Button>
        </div>
      </header>

      {/* POS Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
