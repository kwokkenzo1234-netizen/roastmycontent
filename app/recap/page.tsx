import type { Metadata } from "next"
import Link from "next/link"
import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { supabaseAdmin } from "@/lib/supabase"
import { categoryLabel } from "@/lib/categories"
import RecapActions from "@/components/recap-actions"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Recap Mingguan — RoastMyContent",
  robots: { index: false, follow: false },
}

interface RecapRow {
  week_start: string
  week_end: string
  total_roasts: number
  average_score: number
  best_category: string | null
  worst_category: string | null
  spiciest_roast: string | null
}

function formatRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }
  return `${new Date(start).toLocaleDateString("id-ID", opts)} – ${new Date(end).toLocaleDateString("id-ID", opts)}`
}

export default async function RecapPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await currentUser()
  const username = user?.username ?? user?.firstName ?? "kamu"

  const { data: recap } = await supabaseAdmin
    .from("weekly_recaps")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<RecapRow>()

  return (
    <main style={{ minHeight: "100dvh", background: "var(--ink)", padding: "clamp(24px, 5vw, 64px) 0" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 20px" }}>
        <Link
          href="/"
          className="label-mono"
          style={{ color: "var(--smoke)", textDecoration: "none", display: "inline-block", marginBottom: 24 }}
        >
          ← RoastMyContent
        </Link>

        {!recap ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <h1
              style={{
                fontFamily: "var(--font-unbounded)",
                fontWeight: 800,
                fontSize: "clamp(1.4rem, 5vw, 2rem)",
                color: "var(--cream)",
                marginBottom: 12,
              }}
            >
              Belum ada recap
            </h1>
            <p style={{ color: "var(--smoke)", lineHeight: 1.5 }}>
              Recap pertama lo muncul di akhir minggu ini. Terus upload!
            </p>
          </div>
        ) : (
          <>
            {/* Card recap */}
            <div className="card-cream animate-stamp-in" style={{ padding: "clamp(20px, 5vw, 32px)", position: "relative" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: "var(--ember)" }} />
              <p className="label-mono" style={{ color: "var(--ember-deep)" }}>RECAP MINGGU INI</p>
              <p style={{ color: "var(--smoke)", fontSize: "0.85rem", marginTop: 2 }}>
                {formatRange(recap.week_start, recap.week_end)}
              </p>

              <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "16px 0" }}>
                <span style={{ fontFamily: "var(--font-unbounded)", fontWeight: 900, fontSize: "clamp(3rem, 14vw, 5rem)", color: "var(--ink)", lineHeight: 1 }}>
                  {Math.round(Number(recap.average_score))}
                </span>
                <span className="label-mono" style={{ color: "var(--smoke)" }}>
                  / 100 · {recap.total_roasts} roast
                </span>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {recap.best_category && (
                  <span className="badge-acid" style={{ background: "var(--acid)", color: "var(--ink)" }}>
                    Terbaik: {categoryLabel(recap.best_category)}
                  </span>
                )}
                {recap.worst_category && (
                  <span className="badge-acid" style={{ background: "var(--ember)", color: "var(--cream)" }}>
                    Terlemah: {categoryLabel(recap.worst_category)}
                  </span>
                )}
              </div>

              {recap.spiciest_roast && (
                <p style={{ fontFamily: "var(--font-jakarta)", fontStyle: "italic", color: "var(--ink-soft)", lineHeight: 1.5 }}>
                  &ldquo;{recap.spiciest_roast.slice(0, 100)}&hellip;&rdquo;
                </p>
              )}

              <div style={{ height: 1, background: "var(--cream-dim)", margin: "16px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontFamily: "var(--font-unbounded)", fontWeight: 800, color: "var(--ink)", fontSize: "0.8rem" }}>
                  RoastMyContent<span style={{ color: "var(--ember)" }}>.com</span>
                </p>
                <p style={{ fontFamily: "var(--font-space-mono)", color: "var(--smoke)", fontSize: "0.75rem" }}>
                  @{username}
                </p>
              </div>
            </div>

            <RecapActions
              username={username}
              imageUrl={
                `/api/og/recap?avg=${Math.round(Number(recap.average_score))}` +
                `&total=${recap.total_roasts}` +
                `&best=${encodeURIComponent(recap.best_category ?? "-")}` +
                `&worst=${encodeURIComponent(recap.worst_category ?? "-")}` +
                `&spiciest=${encodeURIComponent(recap.spiciest_roast ?? "")}` +
                `&range=${encodeURIComponent(formatRange(recap.week_start, recap.week_end))}` +
                `&u=${encodeURIComponent(username)}`
              }
            />
          </>
        )}
      </div>
    </main>
  )
}
