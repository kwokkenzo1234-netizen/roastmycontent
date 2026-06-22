import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "404 — Halaman ilang | RoastMyContent",
  description: "Halaman yang kamu cari nggak ketemu.",
}

export default function NotFound() {
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
        ERROR 404
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
        HALAMAN
        <br />
        INI ILANG
      </h1>
      <p
        style={{
          color: "var(--smoke)",
          fontFamily: "var(--font-jakarta)",
          maxWidth: "420px",
          lineHeight: 1.5,
        }}
      >
        Link-nya salah, kehapus, atau emang nggak pernah ada. Yang jelas, di sini kosong.
      </p>
      <Link href="/" className="btn-ember" style={{ marginTop: "8px" }}>
        Balik ke Home →
      </Link>
    </main>
  )
}
