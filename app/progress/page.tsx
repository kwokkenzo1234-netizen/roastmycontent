import type { Metadata } from "next"
import Link from "next/link"
import ProgressView from "@/components/progress-view"

export const metadata: Metadata = {
  title: "Progress Konten Lo — RoastMyContent",
  robots: { index: false, follow: false }, // halaman privat per-user
}

export default function ProgressPage() {
  return (
    <main style={{ minHeight: "100dvh", background: "var(--ink)", padding: "clamp(24px, 5vw, 64px) 0" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px" }}>
        <Link
          href="/"
          className="label-mono"
          style={{ color: "var(--smoke)", textDecoration: "none", display: "inline-block", marginBottom: 24 }}
        >
          ← RoastMyContent
        </Link>
        <ProgressView />
      </div>
    </main>
  )
}
