-- Tabel feedback untuk RoastMyContent.
-- Jalankan di Supabase SQL Editor (atau `supabase db push`) SEBELUM deploy.
--
-- Desain "simpel tapi aman":
--  * RLS ON tanpa policy publik → anon/authenticated TIDAK bisa baca/tulis.
--    Hanya service-role key (dipakai server di app/api/feedback/route.ts) yang
--    bypass RLS. Jadi feedback hanya bisa masuk lewat API route kita, bukan
--    langsung dari browser.
--  * Rate limit per-IP ditangani di app (reuse rate_limits + RPC dari 0001).

create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  message    text not null,
  contact    text,                -- opsional: email/WA biar bisa dibales
  user_agent text,
  ip         text,                -- buat trace abuse; bukan ditampilkan ke siapa pun
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

-- Kunci total dari akses publik. Tanpa policy apa pun, hanya service-role
-- (yang bypass RLS) yang bisa menyentuh tabel ini.
alter table public.feedback enable row level security;
