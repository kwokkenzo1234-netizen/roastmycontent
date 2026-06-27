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

  const first5 = history.slice(0, 5)
  const last5 = history.slice(-5)

  return (
    <div>
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
            <XAxis dataKey="date" stroke="#8A8A92" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} stroke="#8A8A92" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#17171A", border: "1px solid #26262A", borderRadius: 0, color: "#F4EFE6" }}
              labelStyle={{ color: "#8A8A92" }}
            />
            <Line type="monotone" dataKey="score" stroke="#FF4D1C" strokeWidth={3} dot={{ r: 3, fill: "#FF4D1C" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Breakdown per kategori */}
      <p className="label-mono" style={{ color: "var(--smoke)", marginTop: 32, marginBottom: 12 }}>
        TREN PER KATEGORI (5 awal vs 5 terakhir)
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
        {CATEGORY_KEYS.map((key) => {
          const a = catAvg(first5, key)
          const b = catAvg(last5, key)
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

      {/* History list */}
      <p className="label-mono" style={{ color: "var(--smoke)", marginTop: 32, marginBottom: 12 }}>
        HISTORI ROAST
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[...history].reverse().map((r) => (
          <div
            key={r.id}
            style={{
              border: "1px solid var(--ink-border)",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p className="label-mono" style={{ color: "var(--smoke)" }}>
                {formatDate(r.created_at)} · {r.character_id}
              </p>
              <p
                style={{
                  color: "var(--cream-dim)",
                  fontSize: "0.85rem",
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "60vw",
                }}
              >
                {r.roast_text}
              </p>
            </div>
            <span
              style={{
                fontFamily: "var(--font-unbounded)",
                fontWeight: 800,
                color: "var(--ember)",
                fontSize: "1.1rem",
              }}
            >
              {Math.round(overallScore(r.category_scores ?? {}))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
