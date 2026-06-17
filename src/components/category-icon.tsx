import {
  Package, Box, Boxes, ShoppingBag, Shirt, Coffee, CupSoda, Cookie, Cake,
  Cpu, Smartphone, Headphones, Pencil, BookOpen, SprayCan, Pill, Home,
  Wrench, Gift, Wine, Utensils, Scissors, Droplet, Tag, Zap, Sparkles,
  Store, Truck, Hammer, Footprints, Baby, PawPrint, Flower2, Leaf,
  type LucideIcon,
} from 'lucide-react'

// Peta nama-ikon → komponen lucide. Kategori menyimpan NAMA (string), bukan emoji.
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Package, Box, Boxes, ShoppingBag, Shirt, Coffee, CupSoda, Cookie, Cake,
  Cpu, Smartphone, Headphones, Pencil, BookOpen, SprayCan, Pill, Home,
  Wrench, Gift, Wine, Utensils, Scissors, Droplet, Tag, Zap, Sparkles,
  Store, Truck, Hammer, Footprints, Baby, PawPrint, Flower2, Leaf,
}

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS)
export const DEFAULT_CATEGORY_ICON = 'Package'

/** Render ikon kategori dari nama. Fallback ke Package bila nama kosong/tak dikenal (mis. data lama emoji). */
export function CategoryIcon({ name, size = 18, className }: { name?: string | null; size?: number; className?: string }) {
  const Icon = (name && CATEGORY_ICONS[name]) || Package
  return <Icon size={size} className={className} />
}
