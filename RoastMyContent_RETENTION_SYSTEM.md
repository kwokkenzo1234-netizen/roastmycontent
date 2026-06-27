# RoastMyContent — Retention System Full Implementation

> Dokumen ini menambahkan: Auth (Clerk), Database (Supabase Postgres), Skor Konten per kategori, Progress Tracking lintas waktu, Weekly Recap shareable, Segmented Social Comparison, dan Adaptive Tone (Roast Mode vs Hype Mode). Kerjakan urut dari atas ke bawah. Ini mengubah app dari stateless menjadi stateful — perubahan besar, kerjakan dengan teliti.

---

## 0. Ringkasan Perubahan

**Sebelum:** User upload video → roast muncul → selesai, tidak ada yang disimpan.

**Sesudah:** User login (Clerk) → upload video → roast + skor konten (10 kategori) disimpan ke histori → user bisa lihat progress dari waktu ke waktu → dapat weekly recap shareable → bisa lihat posisi dia dibanding kreator lain di niche/tier follower yang sama → tone roast adaptif (lebih pedas kalau skor turun, lebih hype kalau skor naik).

**Kenapa butuh auth sekarang:** Semua fitur retensi (progress, recap, comparison) butuh tahu "ini histori siapa". Tanpa auth, tidak ada cara reliable mengikat data ke orang yang sama.

---

## 1. SETUP CLERK (Auth)

### 1.1 Install

```bash
npm install @clerk/nextjs
```

### 1.2 Environment Variables — tambahkan ke `.env.local`

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

> Agent: nilai-nilai ini diisi user dari dashboard clerk.com setelah membuat aplikasi baru. Jangan generate nilai palsu.

### 1.3 Middleware — buat `middleware.ts` di root project

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/uploadthing(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/api/(.*)"],
}
```

> Catatan: landing page (`/`) tetap public supaya orang bisa lihat app sebelum daftar. Tapi untuk SIMPLICITY dan supaya tetap "zero friction" (prinsip dari awal), pertimbangkan: upload + roast PERTAMA KALI tetap bisa tanpa login (gunakan device-based temp ID), TAPI untuk MENYIMPAN histori/progress/recap, user harus sign up. Lihat Bagian 6 untuk implementasi hybrid ini.

### 1.4 Wrap root layout — update `app/layout.tsx`

```typescript
import { ClerkProvider } from "@clerk/nextjs"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="id">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

---

## 2. DATABASE SCHEMA (sudah dijalankan manual oleh Kenzo di Supabase Dashboard)

> Tabel-tabel di bawah ini SUDAH DIBUAT secara manual lewat Supabase SQL Editor. Claude Code tidak perlu menjalankan SQL apapun — cukup tahu struktur datanya untuk menulis kode yang terhubung ke tabel ini lewat `supabaseAdmin` client yang sudah ada di `lib/supabase.ts`.

**Tabel 1: `roast_history`** — menyimpan setiap roast yang pernah dibuat user.
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | primary key |
| user_id | text | Clerk user ID |
| character_id | text | id karakter yang dipakai |
| roast_text | text | isi roast |
| category_scores | jsonb | `{ hook: 80, editing: 65, ... }` |
| badge_positive | text | nullable |
| badge_negative | text | nullable |
| niche | text | nullable |
| follower_tier | text | nullable |
| created_at | timestamp | default now() |

**Tabel 2: `user_profiles`** — data tambahan per user di luar Clerk.
| Kolom | Tipe | Keterangan |
|---|---|---|
| user_id | text | primary key, Clerk user ID |
| niche | text | nullable — 'kuliner', 'beauty', 'gaming', 'edukasi', 'comedy', 'lifestyle', 'lainnya' |
| follower_tier | text | nullable — 'nano', 'micro', 'mid', 'macro' |
| average_score | numeric | default 0 |
| total_roasts | integer | default 0 |
| last_recap_sent_at | timestamp | nullable |
| created_at | timestamp | default now() |

**Tabel 3: `weekly_recaps`** — snapshot mingguan untuk shareable card.
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | primary key |
| user_id | text | Clerk user ID |
| week_start | date | |
| week_end | date | |
| total_roasts | integer | |
| average_score | numeric | |
| score_change | numeric | nullable |
| best_category | text | nullable |
| worst_category | text | nullable |
| spiciest_roast | text | nullable |
| created_at | timestamp | default now() |

RLS disabled di ketiga tabel ini (akses hanya lewat server via `supabaseAdmin` / service role key, sama seperti tabel `rate_limits` sebelumnya).

---

## 3. UPDATE PIPELINE — Simpan ke Database

### 3.1 `lib/supabase.ts` — sudah ada dari INFRA_GUIDE, tidak perlu diubah.

### 3.2 Update `app/api/roast/route.ts`

Tambahkan logic untuk:
1. Ambil `userId` dari Clerk auth
2. Setelah roast selesai, simpan ke `roast_history`
3. Update `user_profiles` (average_score, total_roasts)
4. Hitung adaptive tone berdasarkan tren skor sebelumnya

```typescript
import { auth } from "@clerk/nextjs/server"
import { supabaseAdmin } from "@/lib/supabase"

// Di dalam POST handler, setelah dapat userId dan SEBELUM panggil roastVideo:

const { userId } = await auth()

// Ambil rata-rata skor 3 roast terakhir user untuk adaptive tone
let recentAverage: number | null = null
if (userId) {
  const { data: recentRoasts } = await supabaseAdmin
    .from("roast_history")
    .select("category_scores")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(3)

  if (recentRoasts && recentRoasts.length > 0) {
    const allScores = recentRoasts.flatMap((r) =>
      Object.values(r.category_scores as Record<string, number>)
    )
    recentAverage = allScores.reduce((a, b) => a + b, 0) / allScores.length
  }
}

// Pass recentAverage ke roastVideo untuk adaptive tone (lihat Bagian 4)
const result = await roastVideo(buffer, mimeType, characterId, userContext, recentAverage)

// SETELAH roast selesai, simpan ke database (kalau user login)
if (userId && result.analysis?.category_scores) {
  const scores = Object.values(result.analysis.category_scores) as number[]
  const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length

  await supabaseAdmin.from("roast_history").insert({
    user_id: userId,
    character_id: characterId,
    roast_text: result.roast,
    category_scores: result.analysis.category_scores,
    badge_positive: result.badges?.positive,
    badge_negative: result.badges?.negative,
  })

  // Update atau buat user profile
  const { data: existingProfile } = await supabaseAdmin
    .from("user_profiles")
    .select("total_roasts, average_score")
    .eq("user_id", userId)
    .single()

  if (existingProfile) {
    const newTotal = existingProfile.total_roasts + 1
    const newAverage =
      (existingProfile.average_score * existingProfile.total_roasts + overallScore) / newTotal

    await supabaseAdmin
      .from("user_profiles")
      .update({ total_roasts: newTotal, average_score: newAverage })
      .eq("user_id", userId)
  } else {
    await supabaseAdmin.from("user_profiles").insert({
      user_id: userId,
      total_roasts: 1,
      average_score: overallScore,
    })
  }
}
```

> PENTING: kalau `userId` null (user belum login), roast TETAP BERJALAN seperti biasa (tidak disimpan). Ini mempertahankan "zero friction" untuk first-time user — login hanya diperlukan untuk AKSES fitur progress/recap, bukan untuk roast pertama kali.

---

## 4. ADAPTIVE TONE (Roast Mode vs Hype Mode)

### 4.1 Update `lib/gemini.ts` — fungsi `buildRoastPrompt`

Tambahkan parameter `recentAverage` dan logic tone:

```typescript
function buildRoastPrompt(
  characterId: string,
  userContext: string,
  gender: string,
  ageRange: string,
  categoryScores: Record<string, number>,
  recentAverage: number | null = null
) {
  const character = getCharacter(characterId)
  if (!character) throw new Error("Karakter tidak ditemukan")

  const contextBlock = userContext?.trim()
    ? `\n\nKONTEKS TAMBAHAN DARI CREATOR:\n"${userContext.trim()}"`
    : ""

  const scoresBlock = Object.entries(categoryScores)
    .map(([key, val]) => `- ${key}: ${val}/100`)
    .join("\n")

  const currentAverage =
    Object.values(categoryScores).reduce((a, b) => a + b, 0) / Object.values(categoryScores).length

  // Tentukan adaptive tone
  let toneInstruction = ""
  if (recentAverage !== null) {
    const improvement = currentAverage - recentAverage
    if (improvement > 10) {
      toneInstruction = `\n\nADAPTIVE TONE: Skor user MENINGKAT signifikan dari roast-roast sebelumnya (dari ${recentAverage.toFixed(0)} ke ${currentAverage.toFixed(0)}). Masuk ke "HYPE MODE" — tetap dalam karakter, tapi nada lebih suportif dan mengapresiasi progress, meski tetap ada sedikit roast untuk konsistensi karakter. Beri pengakuan eksplisit bahwa dia membaik.`
    } else if (improvement < -10) {
      toneInstruction = `\n\nADAPTIVE TONE: Skor user MENURUN dari roast-roast sebelumnya (dari ${recentAverage.toFixed(0)} ke ${currentAverage.toFixed(0)}). Masuk ke "ROAST MODE" — lebih pedas dari biasanya, tapi tetap dalam karakter, bukan kejam tanpa alasan.`
    }
  }

  return `Kamu akan me-roast konten creator ini.

PROFIL CREATOR:
- Gender: ${gender}
- Estimasi umur: ${ageRange}${contextBlock}

SCORE OBJEKTIF PER KATEGORI (hasil analisis video):
${scoresBlock}${toneInstruction}

Roast sebagai karakter berikut:

${character.systemPrompt}

SETELAH menulis roast, tentukan 2 badge berdasarkan LOGIKA INI:
- badge_negative: kategori dengan score TERENDAH yang JUGA kamu singgung/kritik di roast kamu.
- badge_positive: kategori dengan score TERTINGGI yang TIDAK kamu kritik negatif di roast kamu.

Balas HANYA dengan JSON valid, tanpa markdown, tanpa backtick:
{
  "roast": "string (teks roast lengkap dalam karakter)",
  "badge_negative": "string (nama kategori)",
  "badge_positive": "string (nama kategori)"
}`
}
```

### 4.2 Update fungsi `roastVideo` untuk pass `recentAverage`

Tambahkan parameter di signature fungsi dan pass ke `buildRoastPrompt`:

```typescript
export async function roastVideo(
  videoBuffer: Buffer,
  mimeType: string,
  characterId: string,
  userContext = "",
  recentAverage: number | null = null
) {
  // ... (kode upload & pass 1 analisis tetap sama) ...

  // PASS 2: gunakan recentAverage
  const roastPrompt = buildRoastPrompt(characterId, userContext, gender, ageRange, categoryScores, recentAverage)
  // ... (sisanya tetap sama)
}
```

---

## 5. PROGRESS TRACKING — Halaman Baru

### 5.1 Buat `app/progress/page.tsx`

Instruksi untuk agent — buat halaman yang menampilkan:

```
Halaman /progress (perlu login, redirect ke /sign-in kalau belum).

Fetch dari Supabase:
- Semua roast_history milik user, diurutkan by created_at
- Hitung rata-rata skor per kategori dari waktu ke waktu

Tampilkan (ikuti brand bold & savage):
1. Header: "Progress Konten Lo" + skor rata-rata keseluruhan saat ini (besar, Unbounded)
2. Grafik garis sederhana (pakai recharts, sudah tersedia) — sumbu X: tanggal roast, 
   sumbu Y: skor rata-rata. Garis warna ember.
3. Breakdown per kategori (10 kategori) — masing-masing kategori tunjukkan 
   tren naik/turun dengan ikon (Phosphor icons: TrendUp/TrendDown) + persentase 
   perubahan dari 5 roast pertama vs 5 roast terakhir
4. List histori roast (scrollable), tiap item: tanggal, karakter, skor rata-rata, 
   link untuk lihat roast lengkap lagi

Kalau user belum punya histori (total_roasts = 0): tampilkan empty state 
"Belum ada histori. Upload video pertama lo dan mulai tracking progress!" 
dengan tombol CTA ke halaman upload.
```

### 5.2 API endpoint — `app/api/progress/route.ts`

```typescript
import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Harus login" }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from("roast_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json({ error: "Gagal ambil data" }, { status: 500 })
  }

  return NextResponse.json({ history: data })
}
```

---

## 6. ONBOARDING NICHE & FOLLOWER TIER (untuk Segmented Comparison)

### 6.1 Buat `app/onboarding/page.tsx`

Instruksi untuk agent:

```
Halaman onboarding singkat (1 kali saja, setelah sign up pertama).

Tampilkan 2 pertanyaan dengan pilihan tombol (bukan dropdown):

1. "Niche konten lo apa?"
   Pilihan: Kuliner, Beauty, Gaming, Edukasi, Comedy, Lifestyle, Lainnya

2. "Berapa follower lo sekarang?"
   Pilihan: 
   - "< 10K (Nano)" → value: nano
   - "10K - 100K (Micro)" → value: micro
   - "100K - 1jt (Mid)" → value: mid
   - "> 1jt (Macro)" → value: macro

Setelah dipilih, POST ke /api/onboarding untuk simpan ke user_profiles, 
lalu redirect ke halaman utama.

Styling: ikuti brand bold & savage, satu pertanyaan per screen 
(mobile-first), tombol besar mudah di-tap.
```

### 6.2 API endpoint — `app/api/onboarding/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Harus login" }, { status: 401 })
  }

  const { niche, followerTier } = await req.json()

  await supabaseAdmin
    .from("user_profiles")
    .upsert({ user_id: userId, niche, follower_tier: followerTier }, { onConflict: "user_id" })

  return NextResponse.json({ success: true })
}
```

---

## 7. SEGMENTED SOCIAL COMPARISON

### 7.1 API endpoint — `app/api/comparison/route.ts`

```typescript
import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Harus login" }, { status: 401 })
  }

  // Ambil profil user untuk tahu niche & tier-nya
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("niche, follower_tier, average_score")
    .eq("user_id", userId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: "Profil belum lengkap" }, { status: 400 })
  }

  // Ambil rata-rata skor SEMUA user di niche + tier yang SAMA
  const { data: peers } = await supabaseAdmin
    .from("user_profiles")
    .select("average_score")
    .eq("niche", profile.niche)
    .eq("follower_tier", profile.follower_tier)

  if (!peers || peers.length < 5) {
    // Terlalu sedikit data untuk perbandingan yang valid
    return NextResponse.json({
      hasEnoughData: false,
      message: "Belum cukup data kreator di niche kamu untuk perbandingan.",
    })
  }

  const peerAverage = peers.reduce((sum, p) => sum + p.average_score, 0) / peers.length
  const percentile =
    (peers.filter((p) => p.average_score <= profile.average_score).length / peers.length) * 100

  return NextResponse.json({
    hasEnoughData: true,
    yourScore: profile.average_score,
    peerAverage,
    percentile: Math.round(percentile),
    niche: profile.niche,
    tier: profile.follower_tier,
    totalPeers: peers.length,
  })
}
```

### 7.2 Tampilan di halaman progress

Instruksi untuk agent:

```
Di app/progress/page.tsx, tambahkan section "Posisi Lo":

Fetch dari /api/comparison. Kalau hasEnoughData true, tampilkan:
"Skor lo lebih tinggi dari [percentile]% kreator [niche] dengan 
follower [tier] lainnya di RoastMyContent."

Styling: card dengan angka percentile besar (Unbounded, warna acid), 
diikuti deskripsi kecil.

Kalau hasEnoughData false, tampilkan pesan yang ada tanpa angka 
(jangan tampilkan data yang tidak valid).

JANGAN buat leaderboard publik dengan nama/ranking individual — 
hanya percentile pribadi vs rata-rata anonim. Ini menjaga privacy 
dan menghindari masalah leaderboard global yang gagal di riset.
```

---

## 8. WEEKLY RECAP (Shareable)

### 8.1 Cron job — `app/api/cron/weekly-recap/route.ts`

> Ini endpoint yang dipanggil otomatis tiap Minggu malam via Vercel Cron.

```typescript
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Ambil semua user yang punya roast dalam 7 hari terakhir
  const { data: recentRoasts } = await supabaseAdmin
    .from("roast_history")
    .select("user_id, category_scores, roast_text, created_at")
    .gte("created_at", weekAgo.toISOString())

  if (!recentRoasts || recentRoasts.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  // Group by user_id
  const byUser: Record<string, typeof recentRoasts> = {}
  for (const roast of recentRoasts) {
    if (!byUser[roast.user_id]) byUser[roast.user_id] = []
    byUser[roast.user_id].push(roast)
  }

  let processed = 0
  for (const [userId, roasts] of Object.entries(byUser)) {
    const allScores = roasts.flatMap((r) => Object.entries(r.category_scores as Record<string, number>))
    const avgByCategory: Record<string, number[]> = {}
    for (const [cat, score] of allScores) {
      if (!avgByCategory[cat]) avgByCategory[cat] = []
      avgByCategory[cat].push(score)
    }

    const categoryAverages = Object.entries(avgByCategory).map(([cat, scores]) => ({
      category: cat,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    }))

    const best = categoryAverages.sort((a, b) => b.avg - a.avg)[0]
    const worst = categoryAverages.sort((a, b) => a.avg - b.avg)[0]
    const overallAvg =
      categoryAverages.reduce((sum, c) => sum + c.avg, 0) / categoryAverages.length

    // Ambil roast terpanjang/paling dramatis sebagai "spiciest"
    const spiciest = roasts.sort((a, b) => b.roast_text.length - a.roast_text.length)[0]

    await supabaseAdmin.from("weekly_recaps").insert({
      user_id: userId,
      week_start: weekAgo.toISOString().split("T")[0],
      week_end: now.toISOString().split("T")[0],
      total_roasts: roasts.length,
      average_score: overallAvg,
      best_category: best.category,
      worst_category: worst.category,
      spiciest_roast: spiciest.roast_text,
    })

    processed++
  }

  return NextResponse.json({ processed })
}
```

### 8.2 Setup cron di `vercel.json` (buat file baru di root kalau belum ada)

```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-recap",
      "schedule": "0 17 * * 0"
    }
  ]
}
```

> Catatan: `0 17 * * 0` = setiap Minggu jam 17:00 UTC = Minggu jam 00:00 WIB (tengah malam, masuk ke hari Senin WIB). Sesuaikan kalau timing yang diinginkan beda.

### 8.3 Halaman recap shareable — `app/recap/page.tsx`

Instruksi untuk agent:

```
Halaman /recap (perlu login).

Fetch weekly_recaps terbaru milik user dari Supabase.

Tampilkan sebagai card shareable (mirip roast-card.tsx tapi 
desain khusus recap):

- Header: "Recap Minggu Ini" + range tanggal
- Skor rata-rata minggu ini (besar)
- "Kategori terbaik: [best_category]" dengan badge acid
- "Kategori terlemah: [worst_category]" dengan badge ember  
- Total roast minggu ini
- Quote singkat dari spiciest_roast (potong ke ~100 karakter)
- Watermark RoastMyContent.com + username (SAMA seperti card roast biasa)
- Tombol "Share Recap" dan "Download"

Generate image card-nya lewat endpoint baru app/api/og/recap/route.tsx 
(duplikat struktur dari app/api/og/route.tsx tapi dengan konten recap).

Kalau belum ada recap (user baru, belum sampai akhir minggu), 
tampilkan: "Recap pertama lo muncul di akhir minggu ini. Terus upload!"
```

---

## 9. Urutan Eksekusi untuk Agent

1. Setup Clerk (Bagian 1) — install, env vars, middleware, provider.
2. Jalankan SQL schema di Supabase (Bagian 2).
3. Update `app/api/roast/route.ts` untuk simpan ke DB (Bagian 3).
4. Update `lib/gemini.ts` untuk adaptive tone (Bagian 4).
5. Buat halaman + API progress tracking (Bagian 5).
6. Buat halaman + API onboarding (Bagian 6).
7. Buat API segmented comparison (Bagian 7).
8. Setup cron + halaman weekly recap (Bagian 8).
9. Test end-to-end: sign up → onboarding → upload video → cek tersimpan di Supabase → upload lagi → cek adaptive tone berubah → cek halaman progress menampilkan data.

---

## 10. Definition of Done

- [ ] User bisa sign up/login via Clerk
- [ ] Roast pertama TETAP bisa tanpa login (zero friction dipertahankan)
- [ ] Roast yang dibuat saat login tersimpan ke `roast_history`
- [ ] `user_profiles` terupdate otomatis (total_roasts, average_score)
- [ ] Onboarding niche + follower tier berfungsi, tersimpan ke DB
- [ ] Adaptive tone berubah ketika skor naik/turun signifikan dari rata-rata 3 roast terakhir
- [ ] Halaman /progress menampilkan grafik tren skor + breakdown kategori
- [ ] Segmented comparison menampilkan percentile HANYA kalau data peer cukup (≥5)
- [ ] Tidak ada leaderboard publik dengan nama individual
- [ ] Weekly recap ter-generate otomatis tiap Minggu via cron
- [ ] Halaman /recap menampilkan card shareable dengan watermark yang sama seperti card roast biasa
- [ ] Semua fitur baru tetap mengikuti brand guidelines (bold & savage, border-radius 0, font yang sama)
