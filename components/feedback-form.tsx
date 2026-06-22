"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { ChatCircle, X } from "@phosphor-icons/react"

const MAX_MESSAGE_CHARS = 1000

type Status = "idle" | "sending" | "done" | "error"

export default function FeedbackForm() {
  // Portal ke document.body biar tombol fixed lolos dari ancestor ber-transform
  // (main pakai animate-fade-in-up → bikin containing block buat position:fixed).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [contact, setContact] = useState("")
  const [website, setWebsite] = useState("") // honeypot — user asli tak pernah isi
  const [status, setStatus] = useState<Status>("idle")
  const [errorMsg, setErrorMsg] = useState("")

  // Tutup modal dengan Esc.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  function reset() {
    setMessage("")
    setContact("")
    setWebsite("")
    setStatus("idle")
    setErrorMsg("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === "sending") return
    if (message.trim().length === 0) {
      setErrorMsg("Tulis dulu feedback-nya.")
      setStatus("error")
      return
    }

    setStatus("sending")
    setErrorMsg("")
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, contact, website }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorMsg(data.error || "Yah gagal kirim. Coba lagi.")
        setStatus("error")
        return
      }
      setStatus("done")
    } catch {
      setErrorMsg("Koneksi bermasalah. Coba lagi.")
      setStatus("error")
    }
  }

  const remaining = MAX_MESSAGE_CHARS - message.length

  if (!mounted) return null

  return createPortal(
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Kasih feedback"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 90,
          fontFamily: "var(--font-unbounded)",
          fontSize: "0.78rem",
          fontWeight: 800,
          letterSpacing: "0.01em",
          color: "var(--ink)",
          background: "var(--ember)",
          border: "2px solid var(--ink)",
          boxShadow: "4px 4px 0 #000",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "7px",
          padding: "12px 16px",
          transition: "transform 0.12s ease, box-shadow 0.12s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translate(-2px, -2px)"
          e.currentTarget.style.boxShadow = "6px 6px 0 #000"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translate(0, 0)"
          e.currentTarget.style.boxShadow = "4px 4px 0 #000"
        }}
      >
        <ChatCircle size={17} weight="bold" />
        Feedback
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Kirim feedback"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "440px",
              background: "var(--ink-soft)",
              border: "2px solid var(--ink-border)",
              boxShadow: "6px 6px 0 #000",
              padding: "24px",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup"
              style={{
                position: "absolute",
                top: "14px",
                right: "14px",
                background: "none",
                border: "none",
                color: "var(--smoke)",
                cursor: "pointer",
                padding: 0,
                display: "flex",
              }}
            >
              <X size={20} weight="bold" />
            </button>

            {status === "done" ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div
                  style={{
                    fontFamily: "var(--font-unbounded)",
                    fontWeight: 800,
                    fontSize: "1.2rem",
                    color: "var(--acid)",
                    marginBottom: "8px",
                  }}
                >
                  MAKASIH! 🔥
                </div>
                <p style={{ color: "var(--smoke)", fontSize: "0.85rem", marginBottom: "18px" }}>
                  Feedback lo udah masuk. Bener-bener dibaca, janji.
                </p>
                <button
                  type="button"
                  className="btn-ember"
                  onClick={() => {
                    setOpen(false)
                    reset()
                  }}
                >
                  Tutup
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h3
                  style={{
                    fontFamily: "var(--font-unbounded)",
                    fontWeight: 800,
                    fontSize: "1.1rem",
                    marginBottom: "4px",
                  }}
                >
                  KASIH FEEDBACK
                </h3>
                <p
                  style={{
                    color: "var(--smoke)",
                    fontSize: "0.78rem",
                    marginBottom: "16px",
                  }}
                >
                  Ada bug, ide, atau uneg-uneg? Gas, langsung ke kita.
                </p>

                {/* Honeypot — disembunyikan dari user, hanya bot yang ngisi */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "-9999px",
                    width: "1px",
                    height: "1px",
                    opacity: 0,
                  }}
                />

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_CHARS))}
                  placeholder="Tulis feedback lo di sini..."
                  rows={4}
                  autoFocus
                  style={{
                    width: "100%",
                    background: "var(--ink)",
                    border: "2px solid var(--ink-border)",
                    color: "var(--cream)",
                    fontFamily: "var(--font-space-mono)",
                    fontSize: "0.85rem",
                    padding: "10px 12px",
                    resize: "vertical",
                    outline: "none",
                  }}
                />
                <div
                  style={{
                    textAlign: "right",
                    fontFamily: "var(--font-space-mono)",
                    fontSize: "0.65rem",
                    color: remaining < 50 ? "var(--ember)" : "var(--smoke)",
                    marginTop: "4px",
                  }}
                >
                  {remaining}
                </div>

                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value.slice(0, 200))}
                  placeholder="Email / WA (opsional, biar bisa dibales)"
                  style={{
                    width: "100%",
                    background: "var(--ink)",
                    border: "2px solid var(--ink-border)",
                    color: "var(--cream)",
                    fontFamily: "var(--font-space-mono)",
                    fontSize: "0.8rem",
                    padding: "10px 12px",
                    outline: "none",
                    marginTop: "8px",
                  }}
                />

                {status === "error" && (
                  <p
                    style={{
                      color: "var(--ember)",
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-space-mono)",
                      marginTop: "10px",
                    }}
                  >
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  className="btn-ember"
                  disabled={status === "sending"}
                  style={{ width: "100%", marginTop: "16px", opacity: status === "sending" ? 0.6 : 1 }}
                >
                  {status === "sending" ? "Ngirim..." : "Kirim feedback"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>,
    document.body
  )
}
