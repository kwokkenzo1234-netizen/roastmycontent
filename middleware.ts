import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

// Route PUBLIC (tanpa login wajib).
//
// PENTING: semua API endpoint dibikin public di level middleware, lalu tiap
// handler ngecek auth-nya SENDIRI kalau perlu (return 401 JSON). Alasannya:
//  - /api/roast HARUS jalan tanpa login (zero-friction roast pertama).
//  - /api/og & /api/og/recap dipakai buat gambar share publik.
//  - /api/cron/* diproteksi CRON_SECRET (Bearer), bukan Clerk.
//  - /api/progress, /api/onboarding, /api/comparison cek userId sendiri →
//    return 401 JSON (kalau di-protect middleware malah balikin redirect/404
//    yang bikin fetch() di client error, bukan JSON yang rapi).
//
// PAGE yang butuh login (mis. /progress, /onboarding, /recap) TIDAK ada di sini,
// jadi otomatis ke-protect → redirect ke /sign-in.
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/api/(.*)"],
}
