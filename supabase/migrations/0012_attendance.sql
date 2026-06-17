-- ═══════════════════════════════════════════════════════════
-- AKAPACK — Migration 0012: Absensi Karyawan
-- Kode unik per karyawan (untuk clock-in/out) + tabel kehadiran.
-- Jalankan di Supabase SQL Editor → Run. Aman diulang.
-- ═══════════════════════════════════════════════════════════

-- Kode absensi unik per karyawan
alter table employees add column if not exists code text;
create unique index if not exists idx_employees_code on employees(code) where code is not null;

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) default '00000000-0000-0000-0000-000000000001',
  employee_id uuid references employees(id) on delete cascade,
  outlet_id uuid references outlets(id),
  type text not null check (type in ('in','out')),
  timestamp timestamptz not null default now(),
  created_at timestamptz default now()
);

create index if not exists idx_attendance_employee on attendance(employee_id);
create index if not exists idx_attendance_ts on attendance(timestamp);

grant all privileges on table attendance to anon, authenticated;
alter table attendance disable row level security;
