# RoastMyContent

AI yang **beneran nonton** video konten creator Indonesia, lalu me-roast-nya
secara spesifik & lucu lewat berbagai karakter (Mamah Dartini, Cici PIK, Bos
Toxic, dll). Hasilnya jadi kartu yang bisa di-share ke IG Story / WA / X.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **Gemini** (`@google/generative-ai`) — analisis + roast video (2-pass)
- **Supabase** — rate limiting per-IP (atomic via RPC)
- **UploadThing** — upload video (path untuk file > 4.5MB di production)
- **Tailwind CSS v4**

## Arsitektur singkat

| Path | Fungsi |
|------|--------|
| `app/page.tsx` | Landing + flow upload → pilih karakter → roast |
| `app/api/roast/route.ts` | Endpoint utama: rate limit → fetch/terima video → Gemini |
| `app/api/og/route.tsx` | Generate kartu roast (OG image, edge runtime) |
| `app/api/uploadthing/*` | Konfigurasi & handler UploadThing |
| `lib/gemini.ts` | Upload ke Gemini File API + 2-pass (analisis → roast) |
| `lib/rate-limit.ts` | Cek limit harian via RPC `check_and_increment_rate_limit` |
| `lib/url-guard.ts` | Anti-SSRF: allowlist host + tolak IP internal |
| `lib/characters.ts` | Definisi karakter + system prompt |

## Setup

1. Install dependency:
   ```bash
   npm install
   ```
2. Buat `.env.local`:
   ```
   GEMINI_API_KEY=...
   SUPABASE_URL=...
   SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   UPLOADTHING_TOKEN=...
   NEXT_PUBLIC_SITE_URL=https://roastmycontent.com   # untuk OG/SEO absolute URL
   ```
3. Jalankan migrasi rate limit di Supabase SQL Editor:
   `supabase/migrations/0001_rate_limit_atomic.sql`
4. Dev server:
   ```bash
   npm run dev
   ```

## Scripts

| Command | Aksi |
|---------|------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Jalankan hasil build |
| `npm run lint` | ESLint |
| `npm run test` | Unit test (Vitest) |

## Keamanan & batasan

- Rate limit: **5 roast/hari/IP** (atomic, fail-closed).
- Upload divalidasi: tipe video allowlist, max 100MB, host UploadThing only (anti-SSRF).
- Tanpa login. Video dihapus dari Gemini & UploadThing setelah diproses.
