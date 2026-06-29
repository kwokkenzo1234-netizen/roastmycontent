"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { TrendUp, TrendDown, Minus } from "@phosphor-icons/react"
import { CATEGORY_KEYS, categoryLabel, overallScore } from "@/lib/categories"
import { getCharacter } from "@/lib/characters"

interface RoastRow {
  id: string
  character_id: string
  roast_text: string
  category_scores: Record<string, number> | null
  badge_positive: string | null
  badge_negative: string | null
  created_at: string
}

interface Comparison {
  hasEnoughData: boolean
  message?: string
  yourScore?: number
  peerAverage?: number
  percentile?: number
  niche?: string
  tier?: string
  totalPeers?: number
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
}

function catAvg(rows: RoastRow[], key: string): number | null {
  const vals = rows
    .map((r) => (r.category_scores ?? {})[key])
    .filter((v): v is number => typeof v === "number")
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export default function ProgressView() {
  const [history, setHistory] = useState<RoastRow[] | null>(null)
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/progress")
        if (!res.ok) throw new Error("gagal")
        const json = await res.json()
        if (active) setHistory(json.history ?? [])
      } catch {
        if (active) setError("Gagal memuat progress. Coba refresh halaman.")
      }
      // Comparison opsional — kalau gagal/profil belum lengkap, halaman tetap jalan.
      try {
        const res = await fetch("/api/comparison")
        const json = await res.json()
        if (active && res.ok) setComparison(json)
      } catch {
        /* abaikan */
      }
    })()
    return () => {
      active = false
    }
  }, [])

  if (error) return <p style={{ color: "var(--smoke)" }}>{error}</p>
  if (history === null) return <p className="label-mono" style={{ color: "var(--smoke)" }}>Memuat…</p>

  // ── Empty state ──
  if (history.length === 0) {
    return (
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
          Belum ada histori
        </h1>
        <p style={{ color: "var(--smoke)", marginBottom: 24, lineHeight: 1.5 }}>
          Upload video pertama lo dan mulai tracking progress!
        </p>
        <Link href="/#upload" className="btn-ember" style={{ display: "inline-block", padding: "14px 28px", textDecoration: "none" }}>
          Mulai Roast →
        </Link>
      </div>
    )
  }

  const chartData = history.map((r) => ({
    date: formatDate(r.created_at),
    score: Math.round(overallScore(r.category_scores ?? {})),
  }))

  const overallNow = Math.round(
    history.reduce((s, r) => s + overallScore(r.category_scores ?? {}), 0) / history.length
  )

  // Delta header: roast terakhir vs sebelumnya (history ascending → index terakhir = terbaru).
  const scoreSeq = history.map((r) => Math.round(overallScore(r.category_scores ?? {})))
  const latestDelta =
    scoreSeq.length >= 2 ? scoreSeq[scoreSeq.length - 1] - scoreSeq[scoreSeq.length - 2] : null

  // Tren per kategori: window awal vs window terakhir yang TIDAK overlap.
  // Butuh min 6 roast biar tiap window isi ≥3 (kalau kurang, sembunyikan — first5/last5
  // lama overlap & nunjukin delta palsu saat data sedikit).
  const TREND_MIN_ROASTS = 6
  const trendWindow = Math.min(5, Math.floor(history.length / 2))
  const showTrend = history.length >= TREND_MIN_ROASTS
  const earlyWindow = history.slice(0, trendWindow)
  const lateWindow = history.slice(history.length - trendWindow)

  return (
    <div>
      <style>{`
        .hist-row { border: 1px solid var(--ink-border); background: var(--ink-soft); transition: border-color 0.12s ease; }
        .hist-row.is-open { border-color: var(--ember); }
        @media (hover: hover) { .hist-row:hover { border-color: var(--ember); } }
        .hist-head {
          width: 100%; background: none; border: none; padding: 12px 14px;
          display: flex; align-items: center; gap: 12px; cursor: pointer;
          text-align: left; color: inherit;
        }
        .hist-emoji { font-size: 1.3rem; line-height: 1; flex-shrink: 0; }
        .hist-main { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .hist-meta { color: var(--smoke); }
        .hist-snippet {
          color: var(--cream-dim); font-size: 0.85rem;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .hist-score {
          font-family: var(--font-unbounded); font-weight: 800;
          color: var(--ember); font-size: 1.1rem; flex-shrink: 0;
        }
        .hist-chev { color: var(--smoke); font-size: 0.8rem; flex-shrink: 0; width: 12px; text-align: center; }
        .hist-body { padding: 0 14px 14px; animation: fade-in-up 0.2s ease both; }
        .hist-full {
          color: var(--cream); font-size: 0.9rem; line-height: 1.55;
          white-space: pre-wrap;
          border-top: 1px solid var(--ink-border); padding-top: 12px;
        }
        .hist-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
        .hist-badge {
          font-family: var(--font-space-mono); font-size: 0.66rem; letter-spacing: 0.04em;
          padding: 3px 8px; text-transform: uppercase;
        }
        .hist-badge.pos { background: var(--acid); color: var(--ink); }
        .hist-badge.neg { background: var(--ember); color: var(--ink); }
        .hist-cats {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 4px 14px; margin-top: 14px;
        }
        .hist-cat {
          display: flex; justify-content: space-between; font-size: 0.72rem;
          color: var(--smoke); font-family: var(--font-space-mono);
          border-bottom: 1px dotted var(--ink-border); padding-bottom: 2px;
        }
        .hist-cat-v { color: var(--cream); }
        @media (prefers-reduced-motion: reduce) {
          .hist-row { transition: none; }
          .hist-body { animation: none; }
        }
      `}</style>
      {/* Header */}
      <p className="label-mono" style={{ color: "var(--smoke)", marginBottom: 4 }}>
        PROGRESS KONTEN LO
      </p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
        <span
          style={{
            fontFamily: "var(--font-unbounded)",
            fontWeight: 900,
            fontSize: "clamp(3rem, 12vw, 5rem)",
            color: "var(--ember)",
            lineHeight: 1,
          }}
        >
          {overallNow}
        </span>
        <span className="label-mono" style={{ color: "var(--smoke)" }}>
          / 100 rata-rata · {history.length} roast
        </span>
      </div>

      {/* Delta roast terakhir — sinyal naik/turun yang konkret & memotivasi */}
      {latestDelta !== null && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            marginBottom: 8,
            fontFamily: "var(--font-space-mono)",
            fontSize: "0.78rem",
            color: latestDelta > 0 ? "#E6FF3A" : latestDelta < 0 ? "#FF4D1C" : "#8A8A92",
          }}
        >
          {latestDelta > 0 ? (
            <TrendUp size={15} weight="bold" />
          ) : latestDelta < 0 ? (
            <TrendDown size={15} weight="bold" />
          ) : (
            <Minus size={15} weight="bold" />
          )}
          <span>
            {latestDelta > 0 ? "+" : ""}
            {latestDelta} dari roast sebelumnya
          </span>
        </div>
      )}

      {/* Comparison "Posisi Lo" */}
      {comparison?.hasEnoughData && (
        <div
          className="card-cream"
          style={{ padding: "20px 24px", marginTop: 24, marginBottom: 8 }}
        >
          <p className="label-mono" style={{ color: "var(--ember-deep)", marginBottom: 8 }}>
            POSISI LO
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span
              style={{
                fontFamily: "var(--font-unbounded)",
                fontWeight: 900,
                fontSize: "clamp(2rem, 8vw, 3rem)",
                color: "var(--ink)",
              }}
            >
              {comparison.percentile}%
            </span>
          </div>
          <p style={{ color: "var(--ink-soft)", lineHeight: 1.5, marginTop: 4 }}>
            Skor lo lebih tinggi dari <strong>{comparison.percentile}%</strong> kreator{" "}
            {comparison.niche} dengan follower {comparison.tier} lainnya di RoastMyContent.
          </p>
        </div>
      )}

      {/* Line chart */}
      <div style={{ marginTop: 32, height: 240, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid stroke="#26262A" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#8A8A92"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={28}
              tickMargin={6}
            />
            <YAxis domain={[0, 100]} stroke="#8A8A92" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#17171A", border: "1px solid #26262A", borderRadius: 0, color: "#F4EFE6" }}
              labelStyle={{ color: "#8A8A92" }}
            />
            <Line type="monotone" dataKey="score" stroke="#FF4D1C" strokeWidth={3} dot={{ r: 3, fill: "#FF4D1C" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Breakdown per kategori — cuma muncul kalau data cukup biar tren gak menyesatkan */}
      <p className="label-mono" style={{ color: "var(--smoke)", marginTop: 32, marginBottom: 12 }}>
        TREN PER KATEGORI ({trendWindow} AWAL VS {trendWindow} TERAKHIR)
      </p>
      {!showTrend ? (
        <p style={{ color: "var(--smoke)", fontSize: "0.82rem", lineHeight: 1.5 }}>
          Roast minimal {TREND_MIN_ROASTS} kali buat lihat tren naik/turun per kategori.
          Baru {history.length} sejauh ini — gas terus. 🔥
        </p>
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
        {CATEGORY_KEYS.map((key) => {
          const a = catAvg(earlyWindow, key)
          const b = catAvg(lateWindow, key)
          const delta = a !== null && b !== null ? b - a : null
          const up = delta !== null && delta > 2
          const down = delta !== null && delta < -2
          return (
            <div
              key={key}
              style={{
                border: "1px solid var(--ink-border)",
                background: "var(--ink-soft)",
                padding: "12px 14px",
              }}
            >
              <p style={{ color: "var(--cream)", fontWeight: 600, fontSize: "0.9rem", marginBottom: 6 }}>
                {categoryLabel(key)}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {up && <TrendUp size={16} weight="bold" color="#E6FF3A" />}
                {down && <TrendDown size={16} weight="bold" color="#FF4D1C" />}
                {!up && !down && <Minus size={16} weight="bold" color="#8A8A92" />}
                <span
                  style={{
                    fontFamily: "var(--font-space-mono)",
                    fontSize: "0.85rem",
                    color: up ? "#E6FF3A" : down ? "#FF4D1C" : "#8A8A92",
                  }}
                >
                  {delta === null ? "—" : `${delta > 0 ? "+" : ""}${Math.round(delta)}`}
                </span>
                <span className="label-mono" style={{ color: "var(--smoke)", marginLeft: "auto" }}>
                  {b === null ? "—" : Math.round(b)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      )}

      {/* History list */}
      <p className="label-mono" style={{ color: "var(--smoke)", marginTop: 32, marginBottom: 12 }}>
        HISTORI ROAST
      </p>
      <p style={{ color: "var(--smoke)", fontSize: "0.78rem", marginTop: -4, marginBottom: 10 }}>
        Ketuk buat baca roast lengkapnya.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[...history].reverse().map((r) => {
          const char = getCharacter(r.character_id)
          const isOpen = expandedId === r.id
          const score = Math.round(overallScore(r.category_scores ?? {}))
          return (
            <div key={r.id} className={`hist-row${isOpen ? " is-open" : ""}`}>
              <button
                className="hist-head"
                onClick={() => setExpandedId(isOpen ? null : r.id)}
                aria-expanded={isOpen}
              >
                <span className="hist-emoji">{char?.emoji ?? "🎬"}</span>
                <span className="hist-main">
                  <span className="label-mono hist-meta">
                    {formatDate(r.created_at)} · {char?.name ?? r.character_id}
                  </span>
                  {!isOpen && <span className="hist-snippet">{r.roast_text}</span>}
                </span>
                <span className="hist-score">{score}</span>
                <span className="hist-chev" aria-hidden>
                  {isOpen ? "▾" : "▸"}
                </span>
              </button>

              {isOpen && (
                <div className="hist-body">
                  <p className="hist-full">{r.roast_text}</p>

                  {(r.badge_positive || r.badge_negative) && (
                    <div className="hist-badges">
                      {r.badge_positive && <span className="hist-badge pos">+ {r.badge_positive}</span>}
                      {r.badge_negative && <span className="hist-badge neg">− {r.badge_negative}</span>}
                    </div>
                  )}

                  {r.category_scores && (
                    <div className="hist-cats">
                      {CATEGORY_KEYS.map((key) => {
                        const v = (r.category_scores ?? {})[key]
                        if (typeof v !== "number") return null
                        return (
                          <div key={key} className="hist-cat">
                            <span>{categoryLabel(key)}</span>
                            <span className="hist-cat-v">{Math.round(v)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
