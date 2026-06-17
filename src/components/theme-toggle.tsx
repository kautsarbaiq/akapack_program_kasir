'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = resolvedTheme === 'dark'
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? 'Mode terang' : 'Mode gelap'}
      title={isDark ? 'Mode terang' : 'Mode gelap'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {/* render Moon dulu sebelum mount untuk hindari mismatch; setelah mount tampilkan sesuai tema */}
      {mounted && isDark ? <Sun size={19} /> : <Moon size={19} />}
    </Button>
  )
}
