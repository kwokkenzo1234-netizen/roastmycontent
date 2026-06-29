import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Harus login" }, { status: 401 })
  }

  // Profil user → tahu niche & tier-nya buat segmentasi peer.
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("niche, follower_tier, average_score")
    .eq("user_id", userId)
    .maybeSingle()

  if (!profile || !profile.niche || !profile.follower_tier) {
    return NextResponse.json({ error: "Profil belum lengkap" }, { status: 400 })
  }

  // niche disimpan "kategori:detail" (mis. "edukasi:AI tools"). Buat segmentasi
  // peer pakai KATEGORI BESAR aja (prefix sebelum ":"), biar grup-nya cukup rame.
  const broad = profile.niche.split(":")[0]

  // Rata-rata skor SEMUA user di kategori + tier yang SAMA (anonim, no nama).
  // .like("kategori%") nangkep yang disimpan "kategori" maupun "kategori:detail".
  const { data: peers } = await supabaseAdmin
    .from("user_profiles")
    .select("average_score")
    .like("niche", `${broad}%`)
    .eq("follower_tier", profile.follower_tier)

  if (!peers || peers.length < 5) {
    // Terlalu sedikit data → jangan tampilkan angka yang gak valid.
    return NextResponse.json({
      hasEnoughData: false,
      message: "Belum cukup data kreator di niche kamu untuk perbandingan.",
    })
  }

  const yourScore = Number(profile.average_score ?? 0)
  const peerAverage =
    peers.reduce((sum, p) => sum + Number(p.average_score ?? 0), 0) / peers.length
  const percentile =
    (peers.filter((p) => Number(p.average_score ?? 0) <= yourScore).length / peers.length) * 100

  return NextResponse.json({
    hasEnoughData: true,
    yourScore,
    peerAverage,
    percentile: Math.round(percentile),
    niche: broad,
    tier: profile.follower_tier,
    totalPeers: peers.length,
  })
}
