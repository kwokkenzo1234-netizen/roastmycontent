"use client" // Error boundaries harus Client Component

import { useEffect } from "react"
import Link from "next/link"

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    // Log error ke console (nanti diganti/dilengkapi Sentry pas DSN sudah ada).
    console.error(error)
  }, [error])

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: "18px",
        padding: "40px 20px",
      }}
    >
      <p
        className="label-mono"
        style={{ color: "var(--ember)", fontSize: "0.75rem", letterSpacing: "0.12em" }}
      >
        YAH, ERROR
      </p>
      <h1
        style={{
          fontFamily: "var(--font-unbounded)",
          fontWeight: 900,
          fontSize: "clamp(2.2rem, 9vw, 4.5rem)",
          lineHeight: 0.95,
          margin: 0,
        }}
      >
        ADA YANG
        <br />
        RUSAK
      </h1>
      <p
        style={{
          color: "var(--smoke)",
          fontFamily: "var(--font-jakarta)",
          maxWidth: "420px",
          lineHeight: 1.5,
        }}
      >
        Sistemnya lagi kumat sebentar. Coba lagi — biasanya langsung beres.
      </p>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center", marginTop: "8px" }}>
        <button onClick={() => unstable_retry()} className="btn-ember">
          Coba Lagi
        </button>
        <Link href="/" className="btn-ghost">
          Balik ke Home
        </Link>
      </div>
    </main>
  )
}
