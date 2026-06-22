-- Atomic, race-free IP rate limiting untuk RoastMyContent.
-- Jalankan di Supabase SQL Editor (atau `supabase db push`).
--
-- Menggantikan pola read-then-write di lib/rate-limit.ts yang rawan race
-- condition. Seluruh increment + cek limit terjadi dalam SATU statement
-- INSERT ... ON CONFLICT yang mengunci baris per-IP.

create table if not exists public.rate_limits (
  ip text not null,
  count integer not null default 0,
  reset_at timestamptz not null
);

-- ON CONFLICT (ip) butuh unique index. `if not exists` aman untuk tabel
-- yang sudah ada maupun yang baru dibuat.
create unique index if not exists rate_limits_ip_key on public.rate_limits (ip);

-- Rapikan tipe reset_at → timestamptz (sadar zona waktu) supaya perhitungan
-- "tengah malam WIB" presisi. Hanya jalan kalau kolomnya masih `timestamp`
-- lama; nilai lama ditafsirkan sebagai UTC (default Supabase). Idempotent —
-- aman dijalankan berulang.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rate_limits'
      and column_name = 'reset_at'
      and data_type = 'timestamp without time zone'
  ) then
    alter table public.rate_limits
      alter column reset_at type timestamptz using reset_at at time zone 'UTC';
  end if;
end $$;

-- Increment atomik + cek limit. Window = sampai tengah malam WIB berikutnya
-- (mempertahankan semantik "balik lagi besok").
create or replace function public.check_and_increment_rate_limit(
  p_ip text,
  p_limit integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
as $$
declare
  v_now timestamptz := now();
  v_next_midnight timestamptz :=
    (date_trunc('day', (now() at time zone 'Asia/Jakarta')) + interval '1 day')
      at time zone 'Asia/Jakarta';
  v_count integer;
  v_reset timestamptz;
begin
  insert into public.rate_limits as rl (ip, count, reset_at)
  values (p_ip, 1, v_next_midnight)
  on conflict (ip) do update
    set count = case
                  when rl.reset_at <= v_now then 1
                  else rl.count + 1
                end,
        reset_at = case
                     when rl.reset_at <= v_now then v_next_midnight
                     else rl.reset_at
                   end
  returning rl.count, rl.reset_at into v_count, v_reset;

  allowed := v_count <= p_limit;
  remaining := greatest(p_limit - v_count, 0);
  reset_at := v_reset;
  return next;
end;
$$;
