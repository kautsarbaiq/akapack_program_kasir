-- 0017: app_config (baris tunggal) untuk flag MODE MAINTENANCE yang bisa di-toggle dari dalam app.
-- Middleware (proxy.ts) membaca flag ini; halaman Pengaturan (owner) menulisnya. Owner tetap bisa masuk.
create table if not exists app_config (
  id int primary key default 1,
  maintenance_mode boolean not null default false,
  maintenance_message text,
  updated_at timestamptz default now(),
  constraint app_config_single_row check (id = 1)
);

insert into app_config (id, maintenance_mode) values (1, false)
on conflict (id) do nothing;

-- Sesuai pola proyek (RLS dinonaktifkan internal), agar anon-key bisa baca/tulis flag.
alter table app_config disable row level security;
