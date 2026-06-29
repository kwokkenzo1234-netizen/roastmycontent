"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const NICHES = [
  { value: "kuliner", label: "Kuliner", emoji: "🍜" },
  { value: "beauty", label: "Beauty", emoji: "💄" },
  { value: "gaming", label: "Gaming", emoji: "🎮" },
  { value: "edukasi", label: "Edukasi", emoji: "📚" },
  { value: "comedy", label: "Comedy", emoji: "😂" },
  { value: "lifestyle", label: "Lifestyle", emoji: "✨" },
  { value: "lainnya", label: "Lainnya", emoji: "✏️" },
]

const TIERS = [
  { value: "nano", label: "< 10K", sub: "Nano" },
  { value: "micro", label: "10K – 100K", sub: "Micro" },
  { value: "mid", label: "100K – 1jt", sub: "Mid" },
  { value: "macro", label: "> 1jt", sub: "Macro" },
]

const DETAIL_EXAMPLES = ["AI tools", "skincare review", "personal finance", "mobile gaming"]
const MAX_DETAIL = 40

export default function OnboardingForm() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [niche, setNiche] = useState<string | null>(null)
  const [detail, setDetail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isLainnya = niche === "lainnya"

  // "Lainnya" gak punya kategori bawaan — detail jadi WAJIB. Tanpa ini yang
  // kesimpan cuma "lainnya" (gak ada artinya buat roast & peer-group comparison).
  // Niche biasa: detail opsional, jadi selalu boleh lanjut.
  const canProceedDetail = !isLainnya || detail.trim().length > 0

  async function finish(followerTier: string) {
    if (!niche) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, nicheDetail: detail.trim(), followerTier }),
      })
      if (!res.ok) throw new Error("gagal")
      router.push("/")
    } catch {
      setError("Gagal menyimpan. Coba lagi ya.")
      setSubmitting(false)
    }
  }

  return (
    <main className="onb-main">
      <style>{`
        .onb-main {
          min-height: 100dvh;
          background: var(--ink);
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 32px 20px;
        }
        .onb-wrap { width: 100%; max-width: 540px; margin: 0 auto; }
        .onb-steps { display: flex; gap: 6px; margin-bottom: 18px; }
        .onb-steps span {
          height: 4px; flex: 1; background: var(--ink-border);
          transition: background 0.25s ease;
        }
        .onb-steps span.on { background: var(--ember); }
        .onb-h1 {
          font-family: var(--font-unbounded);
          font-weight: 800;
          font-size: clamp(1.7rem, 6vw, 2.5rem);
          color: var(--cream);
          line-height: 1.04;
          margin-bottom: 6px;
        }
        .onb-sub {
          font-family: var(--font-jakarta);
          font-size: 0.92rem;
          color: var(--smoke);
          margin-bottom: 22px;
          line-height: 1.45;
        }
        .onb-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .onb-col { display: flex; flex-direction: column; gap: 10px; }
        .onb-card {
          position: relative;
          background: var(--ink-soft);
          border: 2px solid var(--ink-border);
          border-radius: 0;
          padding: 18px 16px;
          color: var(--white);
          font-family: var(--font-unbounded);
          font-weight: 700;
          font-size: 0.98rem;
          letter-spacing: 0.01em;
          text-align: left;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          transition: transform 0.12s cubic-bezier(.2,.8,.2,1), border-color 0.12s ease, background 0.12s ease, color 0.12s ease, box-shadow 0.12s ease;
        }
        .onb-card .emo { font-size: 1.35rem; line-height: 1; }
        .onb-card .sub {
          margin-left: auto;
          font-family: var(--font-space-mono);
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: inherit;
          opacity: 0.6;
        }
        @media (hover: hover) {
          .onb-card:hover {
            border-color: var(--ember);
            background: var(--ember);
            color: var(--ink);
            transform: translate(-3px, -3px);
            box-shadow: 6px 6px 0 0 var(--ember-deep);
          }
        }
        .onb-card:active { transform: translate(0, 0); box-shadow: 2px 2px 0 0 var(--ember-deep); }
        .onb-card:disabled { opacity: 0.45; cursor: default; transform: none; box-shadow: none; }
        .onb-input {
          width: 100%;
          background: var(--ink-soft);
          border: 2px solid var(--ink-border);
          border-radius: 0;
          padding: 16px;
          color: var(--cream);
          font-family: var(--font-jakarta);
          font-size: 1.05rem;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .onb-input::placeholder { color: var(--smoke); }
        .onb-input:focus { border-color: var(--ember); }
        .onb-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        .onb-chip {
          background: none;
          border: 1px solid var(--ink-border);
          border-radius: 0;
          padding: 6px 10px;
          color: var(--smoke);
          font-family: var(--font-space-mono);
          font-size: 0.72rem;
          cursor: pointer;
          transition: color 0.12s ease, border-color 0.12s ease;
        }
        .onb-chip:hover { color: var(--ember); border-color: var(--ember); }
        .onb-actions { display: flex; align-items: center; gap: 16px; margin-top: 18px; }
        .onb-back {
          margin-top: 18px;
          background: none;
          border: none;
          color: var(--smoke);
          font-family: var(--font-space-mono);
          font-size: 0.8rem;
          cursor: pointer;
        }
        .onb-back:hover { color: var(--ember); }
        .onb-skip {
          background: none;
          border: none;
          color: var(--smoke);
          font-family: var(--font-space-mono);
          font-size: 0.82rem;
          cursor: pointer;
        }
        .onb-skip:hover { color: var(--cream); }
        @media (prefers-reduced-motion: reduce) {
          .onb-card, .onb-steps span, .onb-input, .onb-chip { transition: none; }
          .onb-card:hover { transform: none; }
        }
      `}</style>

      <div className="onb-wrap">
        <div className="onb-steps">
          <span className={step >= 1 ? "on" : ""} />
          <span className={step >= 2 ? "on" : ""} />
          <span className={step >= 3 ? "on" : ""} />
        </div>
        <p className="label-mono" style={{ marginBottom: 10, color: "var(--smoke)" }}>
          LANGKAH {step}/3
        </p>

        {step === 1 && (
          <>
            <h1 className="onb-h1">Niche konten lo apa?</h1>
            <p className="onb-sub">Pilih yang paling deket. Nanti bisa diperjelas.</p>
            <div className="onb-grid">
              {NICHES.map((n) => (
                <button
                  key={n.value}
                  className="onb-card"
                  onClick={() => {
                    setNiche(n.value)
                    setStep(2)
                  }}
                  style={n.value === "lainnya" ? { gridColumn: "1 / -1" } : undefined}
                >
                  <span className="emo">{n.emoji}</span>
                  {n.label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="onb-h1">
              {isLainnya ? "Niche lo apa persisnya?" : "Lebih spesifik soal apa?"}
            </h1>
            <p className="onb-sub">
              {isLainnya
                ? "Tulis niche kamu sendiri — biar roast-nya pas."
                : "Opsional. Makin spesifik, makin nyemplung roast-nya ke konten lo."}
            </p>
            <input
              className="onb-input"
              type="text"
              value={detail}
              maxLength={MAX_DETAIL}
              autoFocus
              placeholder={isLainnya ? "mis. ASMR, thrifting, motovlog…" : "mis. AI tools, skincare review…"}
              onChange={(e) => setDetail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canProceedDetail) setStep(3)
              }}
            />
            <div className="onb-chips">
              {DETAIL_EXAMPLES.map((ex) => (
                <button key={ex} type="button" className="onb-chip" onClick={() => setDetail(ex)}>
                  {ex}
                </button>
              ))}
            </div>
            <div className="onb-actions">
              <button
                className="btn-ember"
                disabled={!canProceedDetail}
                onClick={() => setStep(3)}
                style={{
                  flex: 1,
                  opacity: canProceedDetail ? 1 : 0.45,
                  cursor: canProceedDetail ? "pointer" : "not-allowed",
                }}
              >
                Lanjut →
              </button>
              {!isLainnya && (
                <button
                  className="onb-skip"
                  onClick={() => {
                    setDetail("")
                    setStep(3)
                  }}
                >
                  Lewati
                </button>
              )}
            </div>
            <button className="onb-back" onClick={() => setStep(1)}>
              ← balik
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="onb-h1">Berapa follower lo sekarang?</h1>
            <p className="onb-sub">Buat bandingin progres lo sama kreator selevel.</p>
            <div className="onb-col">
              {TIERS.map((t) => (
                <button
                  key={t.value}
                  className="onb-card"
                  disabled={submitting}
                  onClick={() => finish(t.value)}
                >
                  {t.label}
                  <span className="sub">{t.sub}</span>
                </button>
              ))}
            </div>
            <button className="onb-back" onClick={() => setStep(2)} disabled={submitting}>
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
