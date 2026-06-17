'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { Product } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  products: Product[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}

// Pemilih produk dengan pencarian (cari nama / SKU) — untuk katalog besar.
export function ProductCombobox({ products, value, onChange, placeholder = 'Pilih produk…' }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selected = products.find((p) => p.id === value)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  const filtered = (q
    ? products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()))
    : products
  ).slice(0, 60)

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-ring">
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>{selected ? selected.name : placeholder}</span>
        <ChevronDown size={14} className="text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-background shadow-lg">
          <div className="p-2 border-b relative">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / SKU…" className="h-8 pl-8 text-sm" />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.map((p) => (
              <button key={p.id} type="button" onClick={() => { onChange(p.id); setOpen(false); setQ('') }}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-left hover:bg-muted">
                <span className="truncate">{p.name} <span className="text-xs text-muted-foreground">· stok {p.stock}</span></span>
                {p.id === value && <Check size={14} className="text-primary shrink-0" />}
              </button>
            ))}
            {filtered.length === 0 && <p className="text-center text-xs text-muted-foreground py-3">Tidak ada produk</p>}
          </div>
        </div>
      )}
    </div>
  )
}
