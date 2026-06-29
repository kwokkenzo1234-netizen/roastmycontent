import { supabaseAdmin } from "./supabase"
import { overallScore } from "./categories"

// Rata-rata skor dari N roast terakhir user — jadi dasar adaptive tone (Bagian 4).
// Return null kalau user belum punya histori (→ tone normal, bukan hype/roast mode).
export async function getRecentAverage(userId: string, limit = 3): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("roast_history")
    .select("category_scores")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data || data.length === 0) return null

  const allScores = data.flatMap((r) =>
    Object.values((r.category_scores ?? {}) as Record<string, number>)
  )
  if (allScores.length === 0) return null
  return allScores.reduce((a, b) => a + b, 0) / allScores.length
}

// Niche creator dari profil (format "kategori:detail" mis. "edukasi:AI tools").
// Return null kalau belum onboarding / belum login → roast jalan tanpa konteks
// niche (zero-friction roast pertama tetap kepegang).
export async function getUserNiche(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("niche")
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data?.niche) return null
  return data.niche
}

interface SaveRoastArgs {
  userId: string
  characterId: string
  roastText: string
  categoryScores: Record<string, number>
  badgePositive: string | null
  badgeNegative: string | null
}

// Simpan satu roast ke histori + update agregat profil (total_roasts, average_score
// pakai rata-rata berjalan, jadi gak perlu re-scan seluruh histori tiap roast).
export async function saveRoast(args: SaveRoastArgs): Promise<void> {
  const { userId, characterId, roastText, categoryScores, badgePositive, badgeNegative } = args
  const score = overallScore(categoryScores)

  const { error: insertErr } = await supabaseAdmin.from("roast_history").insert({
    user_id: userId,
    character_id: characterId,
    roast_text: roastText,
    category_scores: categoryScores,
    badge_positive: badgePositive,
    badge_negative: badgeNegative,
  })
  if (insertErr) throw insertErr

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("total_roasts, average_score")
    .eq("user_id", userId)
    .maybeSingle()

  if (profile) {
    const total = profile.total_roasts ?? 0
    const newTotal = total + 1
    const newAverage = (Number(profile.average_score ?? 0) * total + score) / newTotal
    await supabaseAdmin
      .from("user_profiles")
      .update({ total_roasts: newTotal, average_score: newAverage })
      .eq("user_id", userId)
  } else {
    await supabaseAdmin
      .from("user_profiles")
      .insert({ user_id: userId, total_roasts: 1, average_score: score })
  }
}
