import { supabaseAdmin } from "./supabase"

// Limit harian roast untuk ANONIM (per IP). Bisa di-override via env saat dev
// (mis. ROAST_DAILY_LIMIT=2) tanpa nyentuh kode; default 5 kalau env kosong/invalid.
const parsedLimit = Number(process.env.ROAST_DAILY_LIMIT)
const DAILY_LIMIT_ANONYMOUS = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5

// Limit harian roast untuk user LOGIN (per userId Clerk). Lebih besar sebagai
// insentif daftar/masuk — counter ikut userId, jadi gak bisa di-reset ganti IP.
const DAILY_LIMIT_LOGGED_IN = 15

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

// Key counter roast — login → "user:<userId>" (lintas-device, gak bisa di-bypass
// dengan ganti IP), anonim → "ip:<ip>". Reserve & refund WAJIB pakai key yang
// sama, makanya dipusatkan di sini.
function roastKey(identifier: string, isLoggedIn: boolean): string {
  return isLoggedIn ? `user:${identifier}` : `ip:${identifier}`
}

// Hybrid: anonim dibatasi per IP (DAILY_LIMIT_ANONYMOUS), user login per userId
// dengan jatah lebih besar (DAILY_LIMIT_LOGGED_IN). `identifier` = IP atau userId.
export async function checkRateLimit(
  identifier: string,
  isLoggedIn = false
): Promise<RateLimitResult> {
  const limit = isLoggedIn ? DAILY_LIMIT_LOGGED_IN : DAILY_LIMIT_ANONYMOUS
  return checkLimitFor(roastKey(identifier, isLoggedIn), limit)
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

// Kembaliin 1 slot yang sudah di-reserve (lihat refund_rate_limit di
// migration 0003). Dipanggil saat roast GAGAL setelah slot dipesan, supaya
// jatah cuma kepotong saat roast benar-benar berhasil. Reservasi atomik di
// awal request tetap mencegah abuse paralel — jadi UX adil TAPI gak bisa
// di-hack. No-op saat bypass (dev). Gagal refund di-log, tidak melempar
// (gagal kembaliin slot tidak boleh bikin response error).
async function refundFor(key: string): Promise<void> {
  if (RATE_LIMIT_BYPASS) return
  const { error } = await supabaseAdmin.rpc("refund_rate_limit", { p_ip: key })
  if (error) console.error("[rate-limit] refund RPC error:", error)
}

// HARUS pakai identifier + isLoggedIn yang sama dengan checkRateLimit di awal
// request, supaya slot yang di-refund = slot yang tadi di-reserve (key cocok).
export async function refundRateLimit(
  identifier: string,
  isLoggedIn = false
): Promise<void> {
  return refundFor(roastKey(identifier, isLoggedIn))
}

export async function refundGlobalRoastCap(): Promise<void> {
  return refundFor("global:roast")
}
