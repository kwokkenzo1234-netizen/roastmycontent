import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { supabaseAdmin } from "@/lib/supabase"

// Whitelist — validasi di boundary, jangan percaya body dari client.
const NICHES = ["kuliner", "beauty", "gaming", "edukasi", "comedy", "lifestyle", "lainnya"]
const TIERS = ["nano", "micro", "mid", "macro"]
const MAX_DETAIL = 40

// Detail niche = teks bebas dari user (mis. "AI tools"). Bersihin sebelum simpan:
// buang ":" (itu separator kita), newline/tab, rapatin spasi, cap panjang.
function sanitizeDetail(raw: unknown): string {
  if (typeof raw !== "string") return ""
  return raw
    .replace(/[:\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_DETAIL)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Harus login" }, { status: 401 })
  }

  const { niche, nicheDetail, followerTier } = await req.json()

  if (!NICHES.includes(niche) || !TIERS.includes(followerTier)) {
    return NextResponse.json({ error: "Pilihan tidak valid" }, { status: 400 })
  }

  // Simpan gabungan "kategori:detail" (mis. "edukasi:AI tools"). Comparison
  // ngelompokin per kategori besar (prefix sebelum ":"), jadi detail bebas gak
  // mecah peer group. Tanpa detail → simpan kategori aja.
  const detail = sanitizeDetail(nicheDetail)
  const storedNiche = detail ? `${niche}:${detail}` : niche

  // upsert: kalau profil sudah ada (mis. dibuat saat roast pertama), cuma update
  // niche + follower_tier — kolom agregat (average_score, total_roasts) gak disentuh.
  const { error } = await supabaseAdmin
    .from("user_profiles")
    .upsert({ user_id: userId, niche: storedNiche, follower_tier: followerTier }, { onConflict: "user_id" })

  if (error) {
    return NextResponse.json({ error: "Gagal simpan profil" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
