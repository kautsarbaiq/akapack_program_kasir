'use client'

import { useState } from 'react'
import { Plus, Pencil, ToggleLeft, ToggleRight, Shield, User, UserCheck, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useEmployeeStore } from '@/stores/use-employee-store'
import { EmployeeFormDialog } from '@/components/dashboard/employee-form-dialog'
import { getInitials, getAvatarColor } from '@/lib/utils'
import type { Employee } from '@/types'
import { toast } from 'sonner'

const ROLE_LABELS: Record<string, string> = { owner: 'Pemilik', manager: 'Manager', cashier: 'Kasir', sales: 'Sales' }
const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  cashier: 'bg-gray-100 text-gray-700',
  sales: 'bg-amber-100 text-amber-700',
}
const ROLE_ICONS: Record<string, React.ComponentType<{ size?: number }>> = { owner: Shield, manager: UserCheck, cashier: User, sales: FileText }

export default function KaryawanPage() {
  const employees = useEmployeeStore((s) => s.employees)
  const storeToggle = useEmployeeStore((s) => s.toggleActive)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Employee | null>(null)

  const toggleActive = (id: string) => {
    const emp = employees.find(e => e.id === id)
    storeToggle(id)
    toast.success(`${emp?.name} ${emp?.is_active ? 'dinonaktifkan' : 'diaktifkan'}`)
  }

  const stats = {
    total: employees.length,
    active: employees.filter(e => e.is_active).length,
    owner: employees.filter(e => e.role === 'owner').length,
    manager: employees.filter(e => e.role === 'manager').length,
    cashier: employees.filter(e => e.role === 'cashier').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manajemen Karyawan</h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola tim dan hak akses karyawan</p>
        </div>
        <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => { setEditTarget(null); setFormOpen(true) }}>
          <Plus size={15} /> Tambah Karyawan
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Karyawan', value: stats.total, color: 'text-foreground' },
          { label: 'Aktif', value: stats.active, color: 'text-emerald-600' },
          { label: 'Manager', value: stats.manager, color: 'text-blue-600' },
          { label: 'Kasir', value: stats.cashier, color: 'text-gray-600' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Employee Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {employees.map((emp) => {
          const RoleIcon = ROLE_ICONS[emp.role]
          return (
            <Card key={emp.id} className={`overflow-hidden transition-all duration-200 ${!emp.is_active ? 'opacity-60' : 'hover:shadow-md'}`}>
              <div className="h-1.5" style={{ background: emp.role === 'owner' ? 'oklch(0.55 0.2 310)' : emp.role === 'manager' ? 'oklch(0.55 0.22 264)' : 'oklch(0.65 0.01 250)' }} />
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className={`text-sm font-bold text-white ${getAvatarColor(emp.name)}`}>
                      {getInitials(emp.name)}
                    </AvatarFallback>
                  </Avatar>
                  <button onClick={() => toggleActive(emp.id)} className="text-muted-foreground hover:text-foreground transition-colors" title={emp.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                    {emp.is_active ? <ToggleRight size={22} className="text-emerald-500" /> : <ToggleLeft size={22} />}
                  </button>
                </div>
                <h3 className="font-semibold">{emp.name}</h3>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <RoleIcon size={12} />
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[emp.role]}`}>
                    {ROLE_LABELS[emp.role]}
                  </span>
                </div>
                {emp.phone && <p className="text-xs text-muted-foreground mt-2">{emp.phone}</p>}
                {emp.pin && <p className="text-xs text-muted-foreground">PIN: ****</p>}
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1"
                    onClick={() => { setEditTarget(emp); setFormOpen(true) }}>
                    <Pencil size={11} /> Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {/* Add card */}
        <Card className="border-dashed cursor-pointer hover:border-primary hover:bg-primary/5 transition-all duration-200"
          onClick={() => { setEditTarget(null); setFormOpen(true) }}>
          <CardContent className="p-5 flex flex-col items-center justify-center h-full min-h-[180px] gap-2">
            <div className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center">
              <Plus size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">Tambah Karyawan</p>
          </CardContent>
        </Card>
      </div>

      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} employee={editTarget} />
    </div>
  )
}
