-- ═══════════════════════════════════════════════════════════
-- AKAPACK — Migration 0009: Akuntansi (Daftar Akun + Jurnal)
-- Daftar Akun (COA), jurnal manual (header + baris). Jurnal POS/Online
-- DITURUNKAN otomatis di app dari tabel transactions (tidak disimpan ganda).
-- Jalankan di Supabase SQL Editor → Run. Aman diulang.
-- ═══════════════════════════════════════════════════════════

-- Daftar Akun / Chart of Accounts
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) default '00000000-0000-0000-0000-000000000001',
  code text not null,
  name text not null,
  type text not null check (type in ('asset','liability','equity','revenue','expense')),
  opening_balance numeric default 0,
  description text,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (tenant_id, code)
);

-- Jurnal (header). source: 'manual' | 'opening' (POS/Online diturunkan di app)
create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) default '00000000-0000-0000-0000-000000000001',
  number text not null,
  date timestamptz not null default now(),
  description text,
  source text default 'manual',
  reference_id uuid,
  created_at timestamptz default now()
);

-- Baris jurnal (debit/kredit per akun)
create table if not exists journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references journal_entries(id) on delete cascade,
  account_id uuid references accounts(id),
  debit numeric default 0,
  credit numeric default 0
);

create index if not exists idx_jlines_entry on journal_lines(entry_id);
create index if not exists idx_jlines_account on journal_lines(account_id);

-- Akses (mode internal) + RLS off, konsisten dengan 0003/0004
grant all privileges on table accounts to anon, authenticated;
grant all privileges on table journal_entries to anon, authenticated;
grant all privileges on table journal_lines to anon, authenticated;
alter table accounts disable row level security;
alter table journal_entries disable row level security;
alter table journal_lines disable row level security;

-- Seed Daftar Akun standar retail (saldo awal balance: Aset 130jt = Kewajiban 20jt + Ekuitas 110jt)
insert into accounts (tenant_id, code, name, type, opening_balance) values
  ('00000000-0000-0000-0000-000000000001','1-100','Kas','asset',10000000),
  ('00000000-0000-0000-0000-000000000001','1-110','Bank','asset',50000000),
  ('00000000-0000-0000-0000-000000000001','1-120','Piutang Usaha','asset',0),
  ('00000000-0000-0000-0000-000000000001','1-130','Persediaan Barang','asset',30000000),
  ('00000000-0000-0000-0000-000000000001','1-200','Peralatan & Mesin','asset',40000000),
  ('00000000-0000-0000-0000-000000000001','1-210','Akumulasi Penyusutan','asset',0),
  ('00000000-0000-0000-0000-000000000001','2-100','Hutang Usaha','liability',20000000),
  ('00000000-0000-0000-0000-000000000001','2-200','Hutang PPN','liability',0),
  ('00000000-0000-0000-0000-000000000001','3-100','Modal Pemilik','equity',110000000),
  ('00000000-0000-0000-0000-000000000001','3-200','Laba Ditahan','equity',0),
  ('00000000-0000-0000-0000-000000000001','3-300','Prive','equity',0),
  ('00000000-0000-0000-0000-000000000001','4-100','Penjualan','revenue',0),
  ('00000000-0000-0000-0000-000000000001','4-110','Pendapatan Pengiriman','revenue',0),
  ('00000000-0000-0000-0000-000000000001','4-200','Pendapatan Lain-lain','revenue',0),
  ('00000000-0000-0000-0000-000000000001','5-100','Harga Pokok Penjualan','expense',0),
  ('00000000-0000-0000-0000-000000000001','5-200','Diskon Penjualan','expense',0),
  ('00000000-0000-0000-0000-000000000001','5-300','Beban Gaji','expense',0),
  ('00000000-0000-0000-0000-000000000001','5-310','Beban Sewa','expense',0),
  ('00000000-0000-0000-0000-000000000001','5-320','Beban Listrik & Air','expense',0),
  ('00000000-0000-0000-0000-000000000001','5-330','Beban Operasional Lain','expense',0),
  ('00000000-0000-0000-0000-000000000001','5-340','Beban Penyusutan','expense',0)
on conflict (tenant_id, code) do nothing;
