"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import UploadZone from "@/components/upload-zone"
import CharacterPicker from "@/components/character-picker"
import ContextInput from "@/components/context-input"
import LoadingState from "@/components/loading-state"
import RoastCard from "@/components/roast-card"
import Reveal from "@/components/reveal"
import FeedbackForm from "@/components/feedback-form"
import { track } from "@vercel/analytics"
import {
  Fire,
  Warning,
  VideoCamera,
  Users,
  ArrowRight,
  Share,
} from "@phosphor-icons/react"

type AppState = "idle" | "uploaded" | "roasting" | "result"

interface RoastResult {
  roast: string
  analysis?: {
    transcript: string
    hook_strength: "weak" | "medium" | "strong"
    weak_points: string[]
  } | null
  rateLimit?: { remaining: number }
}

// Hoisted ke module scope — kalau didefinisikan di dalam Home, tiap render
// bikin tipe komponen baru → React remount seluruh subtree nav.
function Nav({
  slim = false,
  rateLimitRemaining,
}: {
  slim?: boolean
  rateLimitRemaining?: number
}) {
  return (
    <nav className="site-nav" style={{ borderBottom: "1px solid var(--ink-border)", padding: slim ? "14px 0" : "20px 0" }}>
      <div className="nav-inner">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{
            fontFamily: "var(--font-unbounded)",
            fontWeight: 900,
            fontSize: slim ? "0.85rem" : "1rem",
            color: "var(--white)",
            letterSpacing: "0.02em",
          }}>
            Roast<span style={{ color: "var(--ember)" }}>My</span>Content
          </span>
          <span className="badge-acid">BETA</span>
        </div>
        {/* Rate limit counter */}
        {rateLimitRemaining !== undefined && (
          <span className="label-mono" style={{ fontSize: "0.6rem", whiteSpace: "nowrap" }}>
            <span style={{ color: "var(--ember)" }}>{rateLimitRemaining}</span>
            {" "}roast tersisa hari ini
          </span>
        )}
      </div>
    </nav>
  )
}

// Hapus file UploadThing dari server saat user benar-benar selesai dengan video
// itu (ganti video / mulai ulang). File TIDAK lagi dihapus tiap habis roast biar
// "Roast Another" jalan, jadi pembersihan dipindah ke sini. sendBeacon supaya
// tetap kekirim walau halaman pindah. Backstop: cron cleanup harian.
function cleanupUpload(key: string | null) {
  if (!key || typeof navigator === "undefined") return
  const body = JSON.stringify({ fileKey: key })
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/cleanup-upload", new Blob([body], { type: "application/json" }))
    } else {
      fetch("/api/cleanup-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    /* best-effort */
  }
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [uploadedKey, setUploadedKey] = useState<string | null>(null)
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null)
  const [userContext, setUserContext] = useState("")
  const [username, setUsername] = useState("")
  const [result, setResult] = useState<RoastResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const formSectionRef = useRef<HTMLDivElement>(null)

  // User memilih file (baik lokal maupun via drag drop)
  const handleFileSelect = (file: File) => {
    // Ganti video → buang upload lama (kalau ada) dari UploadThing.
    cleanupUpload(uploadedKey)
    setSelectedFile(file)
    setUploadedUrl(null)
    setUploadedKey(null)
    setAppState("uploaded")
    setError(null)
    setTimeout(() => {
      formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 300)
  }

  // UploadThing selesai upload → simpan URL + key
  const handleUploadComplete = (fileUrl: string, fileKey: string, file: File) => {
    // Upload baru menggantikan yang lama → buang file lama dari UploadThing.
    if (uploadedKey && uploadedKey !== fileKey) cleanupUpload(uploadedKey)
    setUploadedUrl(fileUrl)
    setUploadedKey(fileKey)
    setSelectedFile(file)
    setAppState("uploaded")
    setError(null)
    setTimeout(() => {
      formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 300)
  }

  const handleUploadError = (err: Error) => {
    setError(`Upload gagal: ${err.message}`)
    setSelectedFile(null)
    setUploadedUrl(null)
    setUploadedKey(null)
    setAppState("idle")
  }

  const handleClearFile = () => {
    cleanupUpload(uploadedKey)
    setSelectedFile(null)
    setUploadedUrl(null)
    setUploadedKey(null)
    if (appState === "uploaded") setAppState("idle")
  }

  const handleRoast = async () => {
    if (!selectedFile || !selectedCharacter) return
    setError(null)
    setAppState("roasting")

    try {
      let res: Response
      if (uploadedUrl) {
        // Path A: UploadThing (JSON) — untuk file > 4.5MB di production
        res = await fetch("/api/roast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileUrl: uploadedUrl,
            fileKey: uploadedKey,
            characterId: selectedCharacter,
            context: userContext,
          }),
        })
      } else {
        // Path B: Direct Upload (FormData) — Instant di localhost atau file < 4.5MB di production
        const formData = new FormData()
        formData.append("video", selectedFile)
        formData.append("characterId", selectedCharacter)
        formData.append("context", userContext)

        res = await fetch("/api/roast", {
          method: "POST",
          body: formData,
        })
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Yah error. Coba lagi sebentar.")

      setResult(data)
      setAppState("result")
      track("roast_selesai", { character: selectedCharacter ?? "unknown" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yah error. Coba lagi sebentar.")
      setAppState("uploaded") // balik ke uploaded, bukan idle — biar gak perlu upload ulang
    }
  }

  // Roast video yang SAMA dengan karakter lain — pertahankan upload (no re-upload)
  const handleRoastAnother = () => {
    setResult(null)
    setSelectedCharacter(null)
    setUserContext("")
    setError(null)
    setAppState("uploaded")
    setTimeout(() => {
      formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 60)
  }

  // Mulai dari awal — buang video, balik ke landing kosong
  const handleStartOver = () => {
    cleanupUpload(uploadedKey)
    setAppState("idle")
    setResult(null)
    setSelectedFile(null)
    setUploadedUrl(null)
    setUploadedKey(null)
    setSelectedCharacter(null)
    setUserContext("")
    setError(null)
    window.scrollTo({ top: 0, behavior: "auto" })
  }

  // File siap roast jika file sudah ada (direct / UploadThing) DAN karakter sudah dipilih
  const canRoast = !!selectedFile && !!selectedCharacter

  // ── RESULT STATE ───────────────────────────────────────────────────────────
  if (appState === "result" && result) {
    return (
      <main key="result" className="animate-fade-in-up" style={{ background: "var(--ink)", minHeight: "100dvh" }}>
        <Nav slim rateLimitRemaining={result?.rateLimit?.remaining} />
        <div className="page-container" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
          <RoastCard
            result={result}
            characterId={selectedCharacter!}
            username={username}
            onRoastAnother={handleRoastAnother}
            onStartOver={handleStartOver}
          />
        </div>
      </main>
    )
  }

  // ── LOADING STATE ──────────────────────────────────────────────────────────
  if (appState === "roasting") {
    return (
      <div className="animate-fade-in">
        <LoadingState characterId={selectedCharacter!} />
      </div>
    )
  }

  // ── IDLE / UPLOADED STATE ──────────────────────────────────────────────────
  return (
    <main key="landing" className="animate-fade-in-up has-mobile-cta" style={{ background: "var(--ink)", minHeight: "100dvh" }}>
      <Nav rateLimitRemaining={result?.rateLimit?.remaining} />

      {/* ── HERO — 2-col desktop ── */}
      <section style={{ padding: "clamp(40px, 8vw, 110px) 0" }}>
        <div className="page-container">
          <div className="hero-grid">

            {/* Left: headline + CTA */}
            <div>
              <p className="label-mono" style={{ marginBottom: "12px", letterSpacing: "0.12em" }}>
                AI ROAST · KONTEN CREATOR · INDONESIA
              </p>
              <h1 style={{
                fontFamily: "var(--font-unbounded)",
                fontWeight: 900,
                fontSize: "clamp(1.8rem, 4.5vw, 3.4rem)",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                color: "var(--white)",
                textTransform: "uppercase",
                marginBottom: "16px",
              }}>
                Berani Upload?{" "}
                <br />
                Berani{" "}
                <span style={{ color: "var(--ember)" }}>Diroast.</span>
              </h1>

              <p style={{
                fontFamily: "var(--font-jakarta)",
                fontWeight: 400,
                fontSize: "clamp(0.85rem, 1.4vw, 1rem)",
                lineHeight: 1.6,
                color: "var(--smoke)",
                marginBottom: "28px",
                maxWidth: "440px",
              }}>
                AI <strong style={{ color: "var(--white)" }}>beneran nonton</strong> video lo, terus ngehina kontennya secara spesifik &amp; lucu — hasilnya jadi kartu yang bisa lo pamerin.{" "}
                <strong style={{ color: "var(--white)" }}>Siap mental?</strong>
              </p>

              <a
                href="#upload"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById("upload")?.scrollIntoView({ behavior: "smooth" })
                }}
                className="btn-ember"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "14px 26px",
                  fontSize: "0.9rem",
                  textDecoration: "none",
                }}
              >
                <Fire size={18} weight="fill" />
                SINI, UPLOAD. BERANI?
              </a>

              <div style={{ display: "flex", gap: "24px", marginTop: "24px", flexWrap: "wrap" }}>
                {[
                  { icon: <VideoCamera size={13} weight="bold" />, text: "Max 3 menit" },
                  { icon: <Users size={13} weight="bold" />, text: "Gak perlu login" },
                  { icon: <Fire size={13} weight="bold" />, text: "5x gratis/hari" },
                ].map(({ icon, text }) => (
                  <div key={text} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "var(--smoke)",
                    fontFamily: "var(--font-space-mono)",
                    fontSize: "0.62rem",
                    letterSpacing: "0.06em",
                  }}>
                    {icon}
                    {text}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: demo card */}
            <div>
              <p className="label-mono" style={{ marginBottom: "14px" }}>CONTOH OUTPUT</p>
              <div
                className="card-cream"
                style={{ padding: "28px 24px", position: "relative", overflow: "hidden", transition: "transform 0.14s ease, box-shadow 0.14s ease" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translate(-2px, -2px)"; e.currentTarget.style.boxShadow = "8px 8px 0px #000000" }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "6px 6px 0px #000000" }}
              >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "5px", background: "var(--ember)" }} />
                <div style={{ marginBottom: "14px" }}>
                  <p style={{ fontFamily: "var(--font-space-mono)", fontSize: "0.58rem", letterSpacing: "0.12em", color: "var(--ember-deep)", textTransform: "uppercase", marginBottom: "4px" }}>DIROAST OLEH</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <p style={{ fontFamily: "var(--font-unbounded)", fontWeight: 800, fontSize: "1.1rem", color: "var(--ink)" }}>MAMAH DARTINI</p>
                    <span style={{ background: "var(--acid)", color: "var(--ink)", fontFamily: "var(--font-space-mono)", fontSize: "0.52rem", fontWeight: 700, letterSpacing: "0.08em", padding: "2px 8px", textTransform: "uppercase" }}>VERDICT: AMPAS</span>
                  </div>
                </div>
                <div style={{ height: "1px", background: "var(--cream-dim)", marginBottom: "14px" }} />
                <p style={{
                  fontFamily: "var(--font-jakarta)",
                  fontWeight: 500,
                  fontSize: "0.9rem",
                  lineHeight: 1.6,
                  color: "var(--ink)",
                  fontStyle: "italic",
                  marginBottom: "18px",
                  maxWidth: "320px",
                }}>
                  &ldquo;Aduh, hook 3 detik pertama kamu itu kayak gorengan basi — orang langsung buang sebelum dicoba. Terus angle kameranya miring ke kiri, Neng. Ini konten apa foto KTP?&rdquo;
                </p>
                <div style={{ height: "1px", background: "var(--cream-dim)", marginBottom: "12px" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontFamily: "var(--font-unbounded)", fontWeight: 800, fontSize: "0.68rem", color: "var(--ink)" }}>RoastMyContent<span style={{ color: "var(--ember)" }}>.com</span></p>
                  <p style={{ fontFamily: "var(--font-space-mono)", fontSize: "0.58rem", color: "var(--smoke)" }}>@contoh_creator</p>
                </div>
              </div>
              <p className="label-mono" style={{ marginTop: "10px", fontSize: "0.58rem", display: "flex", alignItems: "center", gap: "6px" }}>
                <Share size={11} weight="bold" />
                Download &amp; share ke IG Story / WA / X
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── FORM SECTION — 2-col desktop ── */}
      <section
        id="upload"
        ref={formSectionRef}
        style={{ borderTop: "1px solid var(--ink-border)", padding: "clamp(48px, 10vw, 140px) 0", scrollMarginTop: "80px" }}
      >
        <div className="page-container">
          <div className="form-grid">

            {/* LEFT: Upload + username */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                <p className="label-mono">LANGKAH 1 — UPLOAD VIDEO</p>
                <div style={{ flex: 1, height: "1px", background: "var(--ink-border)" }} />
              </div>

              <UploadZone
                onUploadComplete={handleUploadComplete}
                onUploadError={handleUploadError}
                onFileSelect={handleFileSelect}
                selectedFile={selectedFile}
                onClear={handleClearFile}
                disabled={false}
              />

              {/* Username */}
              <div style={{ marginTop: "16px" }}>
                <label htmlFor="username-input" style={{
                  fontFamily: "var(--font-jakarta)",
                  fontSize: "0.8rem",
                  color: "var(--smoke)",
                  display: "block",
                  marginBottom: "8px",
                }}>
                  Handle/username lo{" "}
                  <span style={{ color: "var(--smoke)", fontWeight: 600 }}>(opsional — buat watermark card)</span>
                </label>
                <input
                  id="username-input"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/^@/, ""))}
                  placeholder="@rizki_creator"
                  maxLength={30}
                  suppressHydrationWarning
                  style={{
                    width: "100%",
                    background: "var(--ink-soft)",
                    border: "1px solid var(--ink-border)",
                    borderRadius: 0,
                    color: "var(--white)",
                    fontFamily: "var(--font-space-mono)",
                    fontSize: "0.875rem",
                    padding: "10px 14px",
                    outline: "none",
                    transition: "border-color 0.15s ease",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ember)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ink-border)")}
                />
              </div>

              <p className="label-mono" style={{ marginTop: "12px", fontSize: "0.62rem" }}>
                5 roast/hari/IP · gak perlu login
              </p>
            </div>

            {/* RIGHT: Character picker + context + CTA */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                <p className="label-mono">LANGKAH 2 — PILIH KARAKTER</p>
                <div style={{ flex: 1, height: "1px", background: "var(--ink-border)" }} />
              </div>

              <p style={{
                fontFamily: "var(--font-unbounded)",
                fontWeight: 700,
                fontSize: "clamp(1rem, 3vw, 1.3rem)",
                color: "var(--white)",
                marginBottom: "16px",
                lineHeight: 1.2,
              }}>
                Pilih Siapa yang Ngroast Lo.
              </p>

              <CharacterPicker
                selectedId={selectedCharacter}
                onSelect={setSelectedCharacter}
              />

              <div style={{
                marginTop: "16px",
                padding: "14px 16px",
                background: "var(--ink-soft)",
                border: "1px solid var(--ink-border)",
              }}>
                <ContextInput value={userContext} onChange={setUserContext} />
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  marginTop: "14px",
                  padding: "12px 16px",
                  background: "rgba(255, 59, 59, 0.08)",
                  border: "1px solid rgba(255, 59, 59, 0.3)",
                  color: "#ff6b6b",
                  fontFamily: "var(--font-jakarta)",
                  fontSize: "0.875rem",
                  lineHeight: 1.4,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                }}>
                  <Warning size={18} weight="fill" style={{ flexShrink: 0, marginTop: "1px" }} />
                  {error}
                </div>
              )}

              {/* Main CTA */}
              <button
                id="roast-submit-btn"
                onClick={handleRoast}
                disabled={!canRoast}
                suppressHydrationWarning
                className="btn-ember"
                style={{
                  width: "100%",
                  padding: "18px",
                  fontSize: "1.1rem",
                  marginTop: "20px",
                  opacity: canRoast ? 1 : 0.35,
                  cursor: canRoast ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                }}
              >
                <Fire size={22} weight="fill" />
                ROAST GUE
              </button>

              {!canRoast && (
                <p className="label-mono" style={{ textAlign: "center", marginTop: "8px", fontSize: "0.6rem" }}>
                  {!uploadedUrl ? "Upload video dulu" : "Pilih karakter dulu"}
                </p>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* ── CARA KERJA ── */}
      <section style={{ borderTop: "1px solid var(--ink-border)", padding: "clamp(40px,6vw,64px) 0" }}>
        <div className="page-container">
          <div style={{ marginBottom: "32px" }}>
            <p className="label-mono" style={{ color: "var(--ember)", letterSpacing: "0.14em", marginBottom: "10px" }}>
              CARA KERJA — 4 LANGKAH
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              <h2 style={{
                fontFamily: "var(--font-unbounded)",
                fontWeight: 800,
                fontSize: "clamp(1.6rem, 4vw, 2.6rem)",
                lineHeight: 1.05,
                letterSpacing: "-0.01em",
                textTransform: "uppercase",
                margin: 0,
              }}>
                Roast <span style={{ color: "var(--ember)" }}>Timeline</span>
              </h2>
              <span aria-hidden="true" style={{
                flex: 1,
                minWidth: "40px",
                height: "3px",
                background: "linear-gradient(90deg, var(--ember), transparent)",
              }} />
              <span style={{
                fontFamily: "var(--font-space-mono)",
                fontWeight: 700,
                fontSize: "0.8rem",
                letterSpacing: "0.05em",
                color: "var(--smoke)",
                whiteSpace: "nowrap",
              }}>01 → 04</span>
            </div>
          </div>
          <div className="pipeline-grid">
            {[
              { num: "01", pct: "25%", icon: <VideoCamera size={22} weight="bold" />, text: "Upload video konten lo (max 3 menit)" },
              { num: "02", pct: "50%", icon: <Users size={22} weight="bold" />, text: "Pilih karakter yang mau ngroast" },
              { num: "03", pct: "75%", icon: <Fire size={22} weight="bold" />, text: "AI nonton video, analisis, & roast spesifik" },
              { num: "04", pct: "100%", icon: <Share size={22} weight="bold" />, text: "Download card, pamerin ke semua orang" },
            ].map(({ num, pct, icon, text }, i, arr) => {
              const isFinal = i === arr.length - 1
              return (
                <Reveal key={num} delay={i * 80}>
                  <div className={isFinal ? "pipeline-card is-final" : "pipeline-card"}>
                    <div className="pipeline-bar" aria-hidden="true">
                      <div className="pipeline-bar-fill" style={{ width: pct }} />
                    </div>
                    <div className="pipeline-body">
                      <div className="pipeline-head">
                        <span className="pipeline-num">{num}</span>
                        <span className="pipeline-pct">{pct}</span>
                      </div>
                      <span className="pipeline-icon">{icon}</span>
                      <span className="pipeline-text">{text}</span>
                    </div>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid var(--ink-border)", padding: "24px 0" }}>
        <div className="nav-inner">
          <span style={{ fontFamily: "var(--font-unbounded)", fontWeight: 800, fontSize: "0.75rem", color: "var(--smoke)" }}>
            Roast<span style={{ color: "var(--ember)" }}>My</span>Content
          </span>
          <span className="label-mono" style={{ fontSize: "0.6rem", display: "flex", alignItems: "center", gap: "16px" }}>
            <Link href="/terms" className="link-quiet" style={{ color: "var(--smoke)", textDecoration: "none" }}>
              Ketentuan
            </Link>
            <Link href="/privacy" className="link-quiet" style={{ color: "var(--smoke)", textDecoration: "none" }}>
              Privasi
            </Link>
          </span>
          <span className="label-mono" style={{ fontSize: "0.6rem", display: "flex", alignItems: "center", gap: "6px" }}>
            By{" "}
            <a href="https://delphio.app" target="_blank" rel="noopener noreferrer"
              style={{ color: "var(--ember)", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px", transition: "color 0.15s ease" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--white)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ember)")}>
              Delphio
              <ArrowRight size={10} weight="bold" />
            </a>
          </span>
        </div>
      </footer>

      <FeedbackForm />

      {/* Sticky CTA (mobile only) — tombol ROAST selalu kejangkau tanpa harus
          scroll jauh ke bawah melewati grid karakter yang tinggi. Kalau belum
          siap, klik-nya nge-scroll ke form. */}
      <div className="mobile-cta-bar">
        <button
          onClick={() => {
            if (canRoast) handleRoast()
            else document.getElementById("upload")?.scrollIntoView({ behavior: "smooth" })
          }}
          className="btn-ember"
          aria-label="Roast video"
          style={{
            width: "100%",
            padding: "15px",
            fontSize: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            opacity: canRoast ? 1 : 0.6,
          }}
        >
          <Fire size={20} weight="fill" />
          {canRoast ? "ROAST GUE" : !selectedFile ? "Upload video dulu" : "Pilih karakter dulu"}
        </button>
      </div>
    </main>
  )
}
