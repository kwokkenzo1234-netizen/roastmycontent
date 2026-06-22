# Deploy Checklist — RoastMyContent

Checklist sebelum & sesudah deploy ke production (Vercel + domain `roastmycontent.com`).
Centang dari atas ke bawah. Yang ditandai 🔴 = **WAJIB**, jangan launch tanpa ini.

---

## 1. 🔴 Database (Supabase)

- [ ] Jalankan migration `supabase/migrations/0001_rate_limit_atomic.sql` di SQL Editor.
- [ ] Jalankan migration `supabase/migrations/0002_feedback.sql` di SQL Editor.
- [ ] 🔴 Jalankan migration `supabase/migrations/0003_rate_limit_refund.sql` di SQL Editor.
      Tanpa ini, refund jatah saat roast GAGAL tidak jalan → user tetap rugi jatah
      walau roast error (fungsi `refund_rate_limit` cuma nge-log error, gak crash).
- [ ] Verifikasi tabel ada: `rate_limits` (dengan unique index `ip`) dan `feedback` (RLS **enabled**).
- [ ] Verifikasi fungsi ada: `check_and_increment_rate_limit` & `refund_rate_limit`.
- [ ] 🟠 Pastikan `SUPABASE_URL` memakai **connection pooler** (port `6543`), bukan koneksi
      langsung (`5432`) — penting untuk serverless biar nggak kehabisan koneksi saat ramai.

> Tanpa migration 0001, rate limit **fail-closed** (semua roast ditolak).
> Tanpa migration 0002, submit feedback error ("gagal kirim").

---

## 2. 🔴 Gemini (Google AI)

- [ ] 🔴 API key memakai **TIER BERBAYAR (billing aktif)**, bukan free tier.
      Di paid tier, data user **TIDAK** dipakai melatih model Google. Ini juga yang
      diklaim di halaman `/privacy` — jadi harus benar-benar paid sebelum live.
- [ ] 🟠 Set **budget alert** di Google Cloud Console (mis. alert di $5 & $15/hari).
- [ ] (Opsional) Set quota cap di Google Cloud sebagai jaring tambahan.

---

## 3. 🔴 Environment Variables (Vercel → Project → Settings → Environment Variables)

Wajib ada (Production):

- [ ] `GEMINI_API_KEY` — key Gemini (paid tier).
- [ ] `SUPABASE_URL` — pakai pooler 6543 (lihat #1).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — service role (server-only, JANGAN diekspos ke client).
- [ ] `UPLOADTHING_TOKEN` — token UploadThing.
- [ ] `NEXT_PUBLIC_SITE_URL` — `https://roastmycontent.com`.
- [ ] `CRON_SECRET` — secret random (mis. `openssl rand -hex 32`) buat auth cron cleanup.
      Vercel Cron otomatis kirim ini sbg `Authorization: Bearer <CRON_SECRET>`. Tanpa ini,
      endpoint `/api/cron/cleanup` nolak semua request (401). Value harus SAMA dgn `.env.local`.

🔴 **JANGAN di-set di production:**

- [ ] 🔴 `ROAST_RATELIMIT_BYPASS` **TIDAK ADA / tidak di-set**.
      Kalau ke-set "1", **semua rate limit + global cap di-bypass** = dompet kebuka lebar.
      (Var ini cuma untuk dev lokal di `.env.local`.)
- [ ] `ROAST_DAILY_LIMIT` — biarkan kosong (default 5) kecuali sengaja mau ubah.
- [ ] 🔴 `WEEKEND_TEST_MODE` di `lib/characters.ts` **= `false`**.
      Kalau `true`, SEMUA karakter weekend tampil & bisa diroast kapan saja (cuma buat tes lokal).

---

## 4. Konfigurasi yang sudah ada di kode (cek nilainya masih sesuai)

| Hal | Nilai sekarang | Lokasi |
|---|---|---|
| Roast / hari / IP | 5 | `lib/rate-limit.ts` (`DAILY_LIMIT`) |
| Feedback / hari / IP | 10 | `lib/rate-limit.ts` (`FEEDBACK_DAILY_LIMIT`) |
| **Global cap roast / hari** | **2000** | `lib/rate-limit.ts` (`GLOBAL_ROAST_CAP`) |
| Max ukuran video | 100MB | `route.ts`, `upload-zone.tsx`, `uploadthing/core.ts` (UploadThing 128MB) |
| Estimasi biaya / roast | ~Rp24 | (dari log `[gemini] token usage`) |

> Worst-case biaya Gemini/hari ≈ `GLOBAL_ROAST_CAP × biaya per roast` ≈ 2000 × Rp24 ≈ **Rp48k/hari**.

---

## 5. Domain & Hosting (Vercel)

- [ ] Domain `roastmycontent.com` ter-pointing ke project Vercel & SSL aktif.
- [ ] Plan Vercel **Hobby** (hemat biaya). ⚠️ Konsekuensi: cron dibatasi **1×/hari** &
      `maxDuration` mentok **60s**. Kalau video besar mulai timeout saat diproses, atau
      storage cepat penuh karena upload yatim numpuk, pertimbangkan balik ke **Pro**.

---

## 6. Halaman legal & konten

- [ ] `/terms` (Ketentuan Layanan) tampil & terbaca.
- [ ] `/privacy` (Kebijakan Privasi) tampil & terbaca.
- [ ] Link "Ketentuan" & "Privasi" muncul di footer.
- [ ] Email kontak di `/terms` & `/privacy` = `qorvel.studio@gmail.com` (Qorvel Studio). Pastikan
      akun Gmail-nya udah dibuat & dipantau sebelum launch.
- [ ] Halaman 404 (`app/not-found.tsx`) & error (`app/error.tsx`) tampil on-brand (tes: buka URL ngasal).

---

## 7. Analytics & monitoring

- [ ] 🔴 **Vercel Analytics**: dashboard Vercel → tab **Analytics** → **Enable**. Komponen
      `<Analytics />` udah dipasang di `app/layout.tsx` (cookieless → nggak butuh cookie banner).
      Data baru kebaca setelah deploy + ada visitor (nggak muncul di localhost).
- [ ] Custom events udah ke-track: `roast_selesai` & `share_diklik` (lihat di tab Analytics → Events).
- [ ] _(Opsional, nyusul)_ Sentry untuk error monitoring — butuh bikin akun + DSN dulu.
- [ ] **Cron cleanup** (`vercel.json` → `/api/cron/cleanup`, sekali sehari — batas Hobby) muncul di
      Vercel → tab **Cron Jobs** setelah deploy. Jaring pengaman buat upload yatim
      (file >1 jam yang roast-nya gak kelar). Butuh `CRON_SECRET` ke-set (lihat #3).

---

## 8. ✅ Smoke test setelah deploy

- [ ] Buka `https://roastmycontent.com` → landing tampil normal.
- [ ] Jalankan 1 roast nyata → hasil keluar; cek log Vercel ada `[gemini] token usage`.
- [ ] Test rate limit: roast sampai habis jatah → muncul pesan "jatah habis" (429).
- [ ] Test video ditolak: upload file > 100MB → ditolak rapi.
- [ ] Test feedback: kirim feedback → cek baris masuk ke tabel `feedback` di Supabase.
- [ ] Test share dari **HP** → kartu roast (gambar) ter-share, link tidak dobel.
- [ ] Cron cleanup jalan: Vercel → **Cron Jobs** → tombol **Run** di `/api/cron/cleanup`
      → response `{"deleted":N}` (bukan 401). Auth `CRON_SECRET` berarti sudah benar.
- [ ] (Opsional) Pantau Vercel + Google Cloud billing di hari-hari pertama.

---

## Catatan

- `ROAST_RATELIMIT_BYPASS=1` hanya untuk dev lokal — di-gitignore di `.env.local`.
- Setelah ubah env var di Vercel, **redeploy** biar perubahan kebaca.
