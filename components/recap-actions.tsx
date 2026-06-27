"use client"

import { useState } from "react"

interface RecapActionsProps {
  imageUrl: string
  username: string
}

// Tombol Share + Download buat card recap. Pola sama seperti roast-card: coba
// Web Share API (mobile) dulu, fallback ke download blob / copy link.
export default function RecapActions({ imageUrl, username }: RecapActionsProps) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  async function handleDownload() {
    setBusy(true)
    setNote(null)
    try {
      const res = await fetch(imageUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `recap-${username}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      // Fallback: buka gambar di tab baru biar bisa save manual.
      window.open(imageUrl, "_blank")
    } finally {
      setBusy(false)
    }
  }

  async function handleShare() {
    setBusy(true)
    setNote(null)
    try {
      const res = await fetch(imageUrl)
      const blob = await res.blob()
      const file = new File([blob], `recap-${username}.png`, { type: "image/png" })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Recap Mingguan RoastMyContent",
          text: "Recap konten gue minggu ini di RoastMyContent.com",
        })
      } else {
        await navigator.clipboard.writeText(`${window.location.origin}/recap`)
        setNote("Link recap disalin ke clipboard.")
      }
    } catch {
      setNote("Gagal share. Coba download aja.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={handleShare} disabled={busy} className="btn-ember" style={{ flex: 1, padding: "14px" }}>
          Share Recap
        </button>
        <button onClick={handleDownload} disabled={busy} className="btn-ghost" style={{ flex: 1, padding: "14px" }}>
          Download
        </button>
      </div>
      {note && (
        <p className="label-mono" style={{ color: "var(--smoke)", textAlign: "center" }}>
          {note}
        </p>
      )}
    </div>
  )
}
