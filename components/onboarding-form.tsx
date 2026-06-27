"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const NICHES = [
  { value: "kuliner", label: "Kuliner" },
  { value: "beauty", label: "Beauty" },
  { value: "gaming", label: "Gaming" },
  { value: "edukasi", label: "Edukasi" },
  { value: "comedy", label: "Comedy" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "lainnya", label: "Lainnya" },
]

const TIERS = [
  { value: "nano", label: "< 10K", sub: "Nano" },
  { value: "micro", label: "10K – 100K", sub: "Micro" },
  { value: "mid", label: "100K – 1jt", sub: "Mid" },
  { value: "macro", label: "> 1jt", sub: "Macro" },
]

export default function OnboardingForm() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [niche, setNiche] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function finish(followerTier: string) {
    if (!niche) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, followerTier }),
      })
      if (!res.ok) throw new Error("gagal")
      router.push("/")
    } catch {
      setError("Gagal menyimpan. Coba lagi ya.")
      setSubmitting(false)
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--ink)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "32px 20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520, margin: "0 auto" }}>
        <p className="label-mono" style={{ marginBottom: 8, color: "var(--smoke)" }}>
          LANGKAH {step}/2
        </p>

        {step === 1 && (
          <>
            <h1
              style={{
                fontFamily: "var(--font-unbounded)",
                fontWeight: 800,
                fontSize: "clamp(1.6rem, 6vw, 2.4rem)",
                color: "var(--cream)",
                lineHeight: 1.05,
                marginBottom: 24,
              }}
            >
              Niche konten lo apa?
            </h1>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {NICHES.map((n) => (
                <button
                  key={n.value}
                  className="btn-ghost"
                  onClick={() => {
                    setNiche(n.value)
                    setStep(2)
                  }}
                  style={{ padding: "18px 12px", fontSize: "1rem" }}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1
              style={{
                fontFamily: "var(--font-unbounded)",
                fontWeight: 800,
                fontSize: "clamp(1.6rem, 6vw, 2.4rem)",
                color: "var(--cream)",
                lineHeight: 1.05,
                marginBottom: 24,
              }}
            >
              Berapa follower lo sekarang?
            </h1>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {TIERS.map((t) => (
                <button
                  key={t.value}
                  className="btn-ghost"
                  disabled={submitting}
                  onClick={() => finish(t.value)}
                  style={{
                    padding: "18px 16px",
                    fontSize: "1.05rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>{t.label}</span>
                  <span className="label-mono" style={{ color: "var(--ember)" }}>
                    {t.sub}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(1)}
              disabled={submitting}
              style={{
                marginTop: 16,
                background: "none",
                border: "none",
                color: "var(--smoke)",
                fontFamily: "var(--font-space-mono)",
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              ← balik
            </button>
          </>
        )}

        {error && (
          <p style={{ color: "var(--ember)", marginTop: 16, fontSize: "0.9rem" }}>{error}</p>
        )}
      </div>
    </main>
  )
}
