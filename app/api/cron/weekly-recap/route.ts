import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export const maxDuration = 60
export const dynamic = "force-dynamic"

interface RoastRow {
  user_id: string
  category_scores: Record<string, number> | null
  roast_text: string
  created_at: string
}

// Cron mingguan (Vercel). Untuk tiap user yang punya roast 7 hari terakhir, bikin
// 1 snapshot weekly_recaps (skor rata2, kategori terbaik/terlemah, roast terpedas).
export async function GET(req: NextRequest) {
  // Auth: sama persis dengan cron cleanup — Vercel kirim "Bearer <CRON_SECRET>".
  const authHeader = req.headers.get("authorization")
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const { data: recentRoasts } = await supabaseAdmin
    .from("roast_history")
    .select("user_id, category_scores, roast_text, created_at")
    .gte("created_at", weekAgo.toISOString())

  if (!recentRoasts || recentRoasts.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  // Group by user_id
  const byUser: Record<string, RoastRow[]> = {}
  for (const roast of recentRoasts as RoastRow[]) {
    if (!byUser[roast.user_id]) byUser[roast.user_id] = []
    byUser[roast.user_id].push(roast)
  }

  let processed = 0
  for (const [userId, roasts] of Object.entries(byUser)) {
    // Kumpulin skor per kategori dari semua roast user minggu ini.
    const byCategory: Record<string, number[]> = {}
    for (const r of roasts) {
      for (const [cat, score] of Object.entries(r.category_scores ?? {})) {
        if (!byCategory[cat]) byCategory[cat] = []
        byCategory[cat].push(score)
      }
    }

    const categoryAverages = Object.entries(byCategory).map(([category, scores]) => ({
      category,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    }))
    if (categoryAverages.length === 0) continue

    // Sort SEKALI ke array baru (jangan mutate dua kali — bug umum: best & worst
    // jadi salah kalau .sort() dipanggil dua kali di array yang sama).
    const sortedDesc = [...categoryAverages].sort((a, b) => b.avg - a.avg)
    const best = sortedDesc[0]
    const worst = sortedDesc[sortedDesc.length - 1]
    const overallAvg =
      categoryAverages.reduce((sum, c) => sum + c.avg, 0) / categoryAverages.length

    // Roast terpanjang dianggap "paling dramatis" → kandidat spiciest.
    const spiciest = [...roasts].sort((a, b) => b.roast_text.length - a.roast_text.length)[0]

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
