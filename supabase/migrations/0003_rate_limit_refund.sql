-- Refund 1 slot rate limit saat roast GAGAL (dipanggil dari lib/rate-limit.ts).
-- Melengkapi check_and_increment_rate_limit (0001): slot di-reserve di awal
-- request, lalu dikembaliin di sini kalau roast tidak berhasil. Dengan begitu
-- jatah cuma kepotong saat roast benar-benar sukses, TAPI reservasi atomik di
-- awal tetap menutup celah abuse request paralel (gak bisa di-hack).
--
-- count tidak pernah turun < 0, dan refund hanya berlaku selama window aktif
-- (sebelum reset_at) — kalau window sudah lewat, count sudah ke-reset sendiri.
--
-- Jalankan di Supabase SQL Editor (sekali, seperti 0001 & 0002).
create or replace function public.refund_rate_limit(p_ip text)
returns void
language plpgsql
as $$
begin
  update public.rate_limits
    set count = greatest(count - 1, 0)
    where ip = p_ip
      and reset_at > now();
end;
$$;
