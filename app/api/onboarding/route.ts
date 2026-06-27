import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { supabaseAdmin } from "@/lib/supabase"

// Whitelist — validasi di boundary, jangan percaya body dari client.
const NICHES = ["kuliner", "beauty", "gaming", "edukasi", "comedy", "lifestyle", "lainnya"]
const TIERS = ["nano", "micro", "mid", "macro"]

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Harus login" }, { status: 401 })
  }

  const { niche, followerTier } = await req.json()

  if (!NICHES.includes(niche) || !TIERS.includes(followerTier)) {
    return NextResponse.json({ error: "Pilihan tidak valid" }, { status: 400 })
  }

  // upsert: kalau profil sudah ada (mis. dibuat saat roast pertama), cuma update
  // niche + follower_tier — kolom agregat (average_score, total_roasts) gak disentuh.
  const { error } = await supabaseAdmin
    .from("user_profiles")
    .upsert({ user_id: userId, niche, follower_tier: followerTier }, { onConflict: "user_id" })

  if (error) {
    return NextResponse.json({ error: "Gagal simpan profil" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
