-- ═══════════════════════════════════════════════════════════
-- AKAPACK — Migration 0002: Multi-tenant (siap SaaS), audit, multi-harga
-- Jalankan SETELAH 0001 di Supabase SQL Editor.
-- Aman dijalankan berulang (idempotent: IF NOT EXISTS / ON CONFLICT).
-- ═══════════════════════════════════════════════════════════

-- ─── Tenant (organisasi/bisnis) — fondasi jalur SaaS ───────
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Tenant default untuk data yang sudah ada (mode internal 1 bisnis)
insert into tenants (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Toko Saya')
on conflict (id) do nothing;

-- ─── Profiles: hubungkan auth.users -> tenant + role ───────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references tenants(id) default '00000000-0000-0000-0000-000000000001',
  full_name text,
  role text default 'owner',          -- owner | manager | cashier
  created_at timestamptz default now()
);

-- Saat user register, otomatis buat profile + tempel ke tenant default
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, tenant_id, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    '00000000-0000-0000-0000-000000000001',
    'owner'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── Tambah tenant_id ke semua tabel inti ──────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'outlets','categories','products','customers','employees',
    'shifts','transactions','stock_movements','promotions'
  ]
  loop
    execute format(
      'alter table %I add column if not exists tenant_id uuid references tenants(id) default ''00000000-0000-0000-0000-000000000001''',
      t
    );
  end loop;
end $$;

-- ─── Audit: created_by (siapa yang membuat) ────────────────
alter table products     add column if not exists created_by uuid references auth.users(id);
alter table customers    add column if not exists created_by uuid references auth.users(id);
alter table employees    add column if not exists created_by uuid references auth.users(id);
alter table promotions   add column if not exists created_by uuid references auth.users(id);
alter table transactions add column if not exists created_by uuid references auth.users(id);
alter table categories   add column if not exists created_by uuid references auth.users(id);

-- ─── Model multi-harga (mengikuti pola Olsera) ─────────────
-- cost_price = harga beli/modal (sudah ada)
-- price       = harga jual toko/POS (sudah ada)
alter table products add column if not exists price_market numeric default 0;  -- harga coret/pasar
alter table products add column if not exists price_online numeric default 0;  -- harga jual online store

-- ═══════════════════════════════════════════════════════════
-- RLS (Row Level Security) — DISIAPKAN, BELUM DI-ENABLE.
-- Aktifkan saat Auth sudah terverifikasi / saat menuju SaaS multi-tenant.
-- Helper: tenant_id milik user yang sedang login.
-- ═══════════════════════════════════════════════════════════
create or replace function current_tenant_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

-- Contoh kebijakan (jalankan blok di bawah HANYA saat siap mengaktifkan RLS):
--
--   alter table products enable row level security;
--   create policy "tenant_isolation_products" on products
--     for all to authenticated
--     using (tenant_id = current_tenant_id())
--     with check (tenant_id = current_tenant_id());
--   -- ulangi untuk: categories, customers, employees, shifts,
--   --   transactions, transaction_items, stock_movements, promotions, outlets
--
-- Sebelum RLS aktif, akses memakai anon key (mode internal). Setelah RLS aktif,
-- setiap query wajib lewat user terautentikasi dengan tenant_id yang cocok.
