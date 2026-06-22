import { supabaseAdmin } from "./supabase"

// Limit harian per IP. Bisa di-override via env saat dev (mis. ROAST_DAILY_LIMIT=2)
// tanpa nyentuh kode; default 5 kalau env kosong/invalid.
const parsedLimit = Number(process.env.ROAST_DAILY_LIMIT)
const DAILY_LIMIT = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5

// Limit harian untuk submit feedback per IP. Counter terpisah dari roast
// (lihat checkFeedbackRateLimit) supaya kirim feedback tidak makan jatah roast.
const FEEDBACK_DAILY_LIMIT = 10

// Cap GLOBAL roast/hari (semua user digabung) — kill-switch anti biaya runaway
// saat abuse/spike viral. Worst-case biaya/hari ≈ cap × biaya per roast.
const GLOBAL_ROAST_CAP = 2000

// Bypass rate limit HANYA kalau di-set eksplisit "1" (untuk testing lokal).
// Production (Vercel) tidak pernah set var ini → limit tetap berlaku penuh.
const RATE_LIMIT_BYPASS = process.env.ROAST_RATELIMIT_BYPASS === "1"

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; remaining: 0; resetAt: Date }

interface RateLimitRow {
  allowed: boolean
  remaining: number
  reset_at: string
}

// Fallback reset time saat RPC gagal (akhir hari, biar UX pesan tetap masuk akal).
function endOfDay(): Date {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

// Inti rate-limit dipakai bersama (roast & feedback). `key` adalah identitas
// counter di tabel rate_limits — pakai IP mentah untuk roast, dan IP ber-prefix
// (mis. "feedback:<ip>") untuk counter terpisah yang tidak saling makan jatah.
async function checkLimitFor(key: string, limit: number): Promise<RateLimitResult> {
  // Dev bypass — unlimited saat testing, tanpa nulis ke DB sama sekali.
  if (RATE_LIMIT_BYPASS) {
    return { allowed: true, remaining: limit }
  }

  // Increment + cek limit dalam satu RPC atomik (lihat
  // supabase/migrations/0001_rate_limit_atomic.sql). Tidak ada race
  // read-then-write seperti implementasi lama.
  const { data, error } = await supabaseAdmin.rpc("check_and_increment_rate_limit", {
    p_ip: key,
    p_limit: limit,
  })

  // FAIL-CLOSED: kalau rate limiter error, tolak request. Melindungi biaya
  // Gemini dari abuse saat DB bermasalah — lebih baik daripada fail-open.
  if (error || !Array.isArray(data) || data.length === 0) {
    console.error("[rate-limit] RPC error — fail-closed:", error)
    return { allowed: false, remaining: 0, resetAt: endOfDay() }
  }

  const row = data[0] as RateLimitRow
  if (!row.allowed) {
    return { allowed: false, remaining: 0, resetAt: new Date(row.reset_at) }
  }

  return { allowed: true, remaining: row.remaining }
}

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  return checkLimitFor(ip, DAILY_LIMIT)
}

// Counter feedback terpisah dari roast lewat prefix "feedback:" pada key —
// row berbeda di rate_limits, jadi submit feedback tidak mengurangi jatah roast.
export async function checkFeedbackRateLimit(ip: string): Promise<RateLimitResult> {
  return checkLimitFor(`feedback:${ip}`, FEEDBACK_DAILY_LIMIT)
}

// Kill-switch global: satu counter untuk SEMUA roast/hari (key "global:roast").
// Dipanggil tepat sebelum panggil Gemini, jadi cuma request valid yang dihitung.
export async function checkGlobalRoastCap(): Promise<RateLimitResult> {
  return checkLimitFor("global:roast", GLOBAL_ROAST_CAP)
}
