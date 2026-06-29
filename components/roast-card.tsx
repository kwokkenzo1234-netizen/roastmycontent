"use client"

import { useState } from "react"
import {
  ShareNetwork,
  DownloadSimple,
  ArrowCounterClockwise,
  CaretDown,
  CaretUp,
  Warning,
  Fire,
  ClipboardText,
} from "@phosphor-icons/react"
import { getCharacter } from "@/lib/characters"
import { useUser } from "@clerk/nextjs"
import { track } from "@vercel/analytics"

// Convert markdown bold (*text*) jadi <strong> beneran, bukan asterisk literal.
function parseMarkdownBold(text: string) {
  return text.split(/(\*[^*]+\*)/g).map((part, i) =>
    part.startsWith("*") && part.endsWith("*") ? (
      <strong key={i} style={{ fontWeight: 800 }}>
        {part.slice(1, -1)}
      </strong>
    ) : (
      part
    )
  )
}

interface RoastResult {
  roast: string
  analysis?: {
    transcript: string
    weak_points: string[]
    estimated_gender?: string
    estimated_age_range?: string
    category_scores?: Record<string, number>
  } | null
  badges?: {
    negative: string | null
    positive: string | null
  } | null
}

interface RoastCardProps {
  result: RoastResult
  characterId: string
  username: string
  onRoastAnother: () => void
  onStartOver: () => void
}

// Kategori score → label badge dengan kata sifat (jelas pujian vs kritik).
const badgeLabels: Record<string, { positive: string; negative: string }> = {
  hook: { positive: "Hook Kuat", negative: "Hook Lemah" },
  editing: { positive: "Editing Rapi", negative: "Editing Berantakan" },
  audio: { positive: "Audio Jernih", negative: "Audio Buruk" },
  delivery: { positive: "Delivery Mantap", negative: "Delivery Flat" },
  visual: { positive: "Visual Oke", negative: "Visual Kurang" },
  script: { positive: "Script Solid", negative: "Script Berantakan" },
  pacing: { positive: "Pacing Enak", negative: "Pacing Buruk" },
  originality: { positive: "Ide Segar", negative: "Ide Pasaran" },
  cta: { positive: "CTA Jelas", negative: "CTA Lemah" },
  relatability: { positive: "Relate Banget", negative: "Kurang Relate" },
}

export default function RoastCard({ result, characterId, username, onRoastAnother, onStartOver }: RoastCardProps) {
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const character = getCharacter(characterId)

  // Clerk v7: useUser (bukan <SignedOut>). isLoaded biar gak flash CTA pas hydrate.
  const { isSignedIn, isLoaded } = useUser()
  const showSignupNudge = isLoaded && !isSignedIn

  const cardUrl = `/api/og?roast=${encodeURIComponent(result.roast)}&character=${encodeURIComponent(character?.name ?? "")}&u=${encodeURIComponent(username || "kamu")}`

  const handleShare = async () => {
    setIsSharing(true)
    track("share_diklik", { character: characterId })
    try {
      const shareUrl = window.location.href
      const title = `Gue diroast sama ${character?.name}!`

      // 1) Coba share GAMBAR kartu roast (Web Share Level 2). Paling viral —
      //    penerima langsung lihat hasilnya, bukan cuma link mentah.
      //    Saat ada file, link disisipkan ke teks (bukan field `url`) supaya
      //    ikut terbawa & tidak dobel.
      let file: File | null = null
      try {
        const res = await fetch(cardUrl)
        if (res.ok) {
          const blob = await res.blob()
          file = new File([blob], `roast-${characterId}.png`, {
            type: blob.type || "image/png",
          })
        }
      } catch {
        // gagal ambil gambar → lanjut ke fallback link di bawah
      }

      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          text: `"${result.roast.slice(0, 100)}..." — Roastin konten lo juga, gih: ${shareUrl}`,
        })
        return
      }

      // 2) Fallback: share link + teks (tanpa gambar). Link lewat field `url`
      //    saja → tidak dobel.
      if (navigator.share) {
        await navigator.share({
          title,
          text: `"${result.roast.slice(0, 100)}..." — Roastin konten lo juga, gih:`,
          url: shareUrl,
        })
        return
      }

      // 3) Last resort (desktop tanpa Web Share): copy teks + link sekali.
      await navigator.clipboard.writeText(
        `"${result.roast}" — Roastin konten lo juga di ${shareUrl}`
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // User cancelled share
    } finally {
      setIsSharing(false)
    }
  }

  const handleDownload = async () => {
    try {
      const response = await fetch(cardUrl)
      if (!response.ok) throw new Error("Gagal mengambil data gambar dari server")
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `roast-${characterId}-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("[download] error:", err)
      // Fallback: buka di tab baru jika fetch blob gagal/terhambat
      const a = document.createElement("a")
      a.href = cardUrl
      a.target = "_blank"
      a.rel = "noopener noreferrer"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  // Badge sinkron dari pipeline (lib/gemini). Null kalau fallback gagal / kategori
  // tak dikenal → tidak dirender (no crash).
  const positiveBadge = result.badges?.positive ? badgeLabels[result.badges.positive]?.positive ?? null : null
  const negativeBadge = result.badges?.negative ? badgeLabels[result.badges.negative]?.negative ?? null : null

  return (
    <div style={{ width: "100%" }}>
      {/* ── DESKTOP: side-by-side card + actions ── */}
      <div className="result-grid">

        {/* LEFT: Shareable Card Preview */}
        <div>
          {/* Header above card */}
          <div style={{ marginBottom: "16px" }}>
            <p className="label-mono" style={{ marginBottom: "6px" }}>DIROAST OLEH</p>
            {/* Nama karakter — baris sendiri (boleh wrap kalau panjang) */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {character?.emoji && (
                <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>{character.emoji}</span>
              )}
              <h2
                style={{
                  fontFamily: "var(--font-unbounded)",
                  fontWeight: 800,
                  fontSize: "clamp(1.3rem, 4vw, 1.8rem)",
                  color: "var(--ember)",
                  margin: 0,
                }}
              >
                {character?.name}
              </h2>
            </div>
            {/* Badge — selalu di baris baru DI BAWAH nama, konsisten utk nama pendek/panjang */}
            {(positiveBadge || negativeBadge) && (
              <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                {positiveBadge && (
                  <span
                    className="badge-acid animate-badge-pop"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "var(--acid)",
                      color: "var(--ink)",
                    }}
                  >
                    <Fire size={12} weight="fill" />
                    {positiveBadge}
                  </span>
                )}
                {negativeBadge && (
                  <span
                    className="badge-acid animate-badge-pop"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "var(--ember)",
                      color: "var(--cream)",
                    }}
                  >
                    <Warning size={12} weight="fill" />
                    {negativeBadge}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Cream card */}
          <div
            className="card-cream animate-stamp-in roast-preview-card"
            style={{
              padding: "clamp(18px, 4vw, 32px)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div className="animate-bar-wipe" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "5px", background: "var(--ember)" }} />

            <div>
              <p style={{
                fontFamily: "var(--font-space-mono)",
                fontSize: "clamp(0.5rem, 1.1vw, 0.58rem)",
                letterSpacing: "0.12em",
                color: "var(--ember-deep)",
                textTransform: "uppercase",
                marginBottom: "2px",
              }}>
                DIROAST OLEH
              </p>
              <p style={{
                fontFamily: "var(--font-unbounded)",
                fontWeight: 800,
                fontSize: "clamp(0.8rem, 2.2vw, 1.2rem)",
                color: "var(--ink)",
                lineHeight: 1.1,
              }}>
                {character?.name?.toUpperCase()}
              </p>
            </div>

            <div style={{ height: "1px", background: "var(--cream-dim)", margin: "8px 0" }} />

            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <p style={{
                fontFamily: "var(--font-jakarta)",
                fontWeight: 500,
                fontSize: "clamp(0.8rem, 2vw, 0.95rem)",
                lineHeight: 1.5,
                color: "var(--ink)",
                fontStyle: "italic",
                whiteSpace: "pre-wrap",
              }}>
                &ldquo;{parseMarkdownBold(result.roast)}&rdquo;
              </p>
            </div>

            <div style={{ height: "1px", background: "var(--cream-dim)", margin: "8px 0" }} />

            {/* Watermark WAJIB */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{
                fontFamily: "var(--font-unbounded)",
                fontWeight: 800,
                fontSize: "clamp(0.5rem, 1.2vw, 0.68rem)",
                color: "var(--ink)",
              }}>
                RoastMyContent<span style={{ color: "var(--ember)" }}>.com</span>
              </p>
              <p style={{
                fontFamily: "var(--font-space-mono)",
                fontSize: "clamp(0.5rem, 1.1vw, 0.58rem)",
                color: "var(--smoke)",
              }}>
                @{username || "kamu"}
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT: Actions + Analysis */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Share */}
          <button
            onClick={handleShare}
            disabled={isSharing}
            className="btn-ember"
            style={{
              width: "100%",
              padding: "16px",
              fontSize: "1rem",
              letterSpacing: "0.04em",
              opacity: isSharing ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            {copied ? (
              <>
                <ClipboardText size={20} weight="fill" />
                Disalin ke clipboard!
              </>
            ) : (
              <>
                <ShareNetwork size={20} weight="bold" />
                Pamerin aib lo
              </>
            )}
          </button>

          {/* Download button */}
          <button
            onClick={handleDownload}
            className="btn-ghost"
            style={{
              width: "100%",
              padding: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontSize: "0.9rem",
            }}
          >
            <DownloadSimple size={18} weight="bold" />
            Download Card (1:1)
          </button>

          {/* Roast video yang SAMA, karakter lain — viral loop (no re-upload) */}
          <button
            onClick={onRoastAnother}
            className="btn-ghost"
            style={{
              width: "100%",
              padding: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontSize: "0.875rem",
            }}
          >
            <ArrowCounterClockwise size={16} weight="bold" />
            Roast pakai karakter lain
          </button>

          {/* Mulai dari awal — video baru (full reset, quiet) */}
          <button
            onClick={onStartOver}
            style={{
              background: "transparent",
              border: "none",
              padding: "8px",
              color: "var(--smoke)",
              fontFamily: "var(--font-jakarta)",
              fontWeight: 500,
              fontSize: "0.8rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--white)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--smoke)")}
          >
            Mulai dari awal (video baru)
          </button>

          {/* Nudge sign-up buat user yang belum login — retention hook (histori skor + progress) */}
          {showSignupNudge && (
            <a
              href="/sign-up"
              className="animate-fade-in-up"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                width: "100%",
                marginTop: "8px",
                padding: "13px 16px",
                background: "var(--ink-soft)",
                border: "1px solid var(--ink-border)",
                borderLeft: "3px solid var(--acid)",
                textDecoration: "none",
                transition: "border-color 0.15s ease, transform 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--acid)"
                e.currentTarget.style.borderLeftColor = "var(--acid)"
                e.currentTarget.style.transform = "translateX(2px)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--ink-border)"
                e.currentTarget.style.borderLeftColor = "var(--acid)"
                e.currentTarget.style.transform = "translateX(0)"
              }}
            >
              <span style={{
                fontFamily: "var(--font-jakarta)",
                fontSize: "0.8rem",
                fontWeight: 500,
                lineHeight: 1.4,
                color: "var(--cream-dim)",
              }}>
                Mau lihat progress konten lo dari waktu ke waktu?
              </span>
              <span style={{
                fontFamily: "var(--font-space-mono)",
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
                color: "var(--acid)",
              }}>
                Sign up gratis →
              </span>
            </a>
          )}

          {/* CTA Delphio */}
          <div
            style={{
              fontFamily: "var(--font-jakarta)",
              fontSize: "12px",
              fontWeight: 400,
              color: "var(--smoke)",
              textAlign: "center",
              marginTop: "12px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "4px",
              whiteSpace: "nowrap",
            }}
          >
            <span>Editing lo kena roast? Delphio bisa bantu.</span>
            <a
              href="https://delphio.app"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--smoke)",
                textDecoration: "none",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--white)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--smoke)")}
            >
              → Join waiting list
            </a>
          </div>

          {/* Expandable analysis */}
          {result.analysis && (
            <div style={{ borderTop: "1px solid var(--ink-border)", paddingTop: "16px", marginTop: "8px" }}>
              <button
                onClick={() => setShowAnalysis((prev) => !prev)}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "0",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--smoke)",
                  fontFamily: "var(--font-space-mono)",
                  fontSize: "0.7rem",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  width: "100%",
                  justifyContent: "space-between",
                }}
              >
                <span>Lihat analisis lengkap</span>
                {showAnalysis ? <CaretUp size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
              </button>

              {showAnalysis && (
                <div className="animate-fade-in-up" style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <p className="label-mono" style={{ marginBottom: "8px" }}>Transcript</p>
                    <p style={{
                      fontFamily: "var(--font-space-mono)",
                      fontSize: "0.72rem",
                      color: "var(--smoke)",
                      lineHeight: 1.6,
                      background: "var(--ink-soft)",
                      padding: "12px 14px",
                      border: "1px solid var(--ink-border)",
                    }}>
                      {result.analysis.transcript || "—"}
                    </p>
                  </div>

                  {(result.analysis.estimated_gender || result.analysis.estimated_age_range) && (
                    <div>
                      <p className="label-mono" style={{ marginBottom: "8px" }}>Profil Creator (Estimasi AI)</p>
                      <div style={{
                        display: "flex",
                        gap: "10px",
                        fontFamily: "var(--font-space-mono)",
                        fontSize: "0.72rem",
                        color: "var(--smoke)",
                      }}>
                        {result.analysis.estimated_gender && (
                          <span style={{
                            background: "var(--ink-soft)",
                            padding: "4px 10px",
                            border: "1px solid var(--ink-border)",
                            textTransform: "uppercase",
                          }}>
                            Gender: {result.analysis.estimated_gender}
                          </span>
                        )}
                        {result.analysis.estimated_age_range && (
                          <span style={{
                            background: "var(--ink-soft)",
                            padding: "4px 10px",
                            border: "1px solid var(--ink-border)",
                            textTransform: "uppercase",
                          }}>
                            Umur: {result.analysis.estimated_age_range.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {result.analysis.weak_points?.length > 0 && (
                    <div>
                      <p className="label-mono" style={{ marginBottom: "8px" }}>Titik lemah</p>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                        {result.analysis.weak_points.map((point, i) => (
                          <li key={i} style={{
                            fontFamily: "var(--font-jakarta)",
                            fontSize: "0.8rem",
                            color: "var(--smoke)",
                            lineHeight: 1.5,
                            paddingLeft: "14px",
                            borderLeft: "2px solid var(--ember)",
                          }}>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  )
}
