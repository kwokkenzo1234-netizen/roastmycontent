import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"

export const runtime = "edge"

async function loadFonts(reqUrl: string) {
  const { origin } = new URL(reqUrl)
  try {
    const [unboundedBold, jakartaMedium] = await Promise.all([
      fetch(new URL("/fonts/unbounded.ttf", origin)).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.arrayBuffer()
      }),
      fetch(new URL("/fonts/jakarta.ttf", origin)).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.arrayBuffer()
      }),
    ])
    return { unboundedBold, jakartaMedium }
  } catch {
    const [unboundedBold, jakartaMedium] = await Promise.all([
      fetch(
        "https://fonts.gstatic.com/s/unbounded/v12/Yq6F-LOTXCb04q32xlpat-6uR42XTqtG65j2040.ttf"
      ).then((r) => r.arrayBuffer()),
      fetch(
        "https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_m07NSg.ttf"
      ).then((r) => r.arrayBuffer()),
    ])
    return { unboundedBold, jakartaMedium }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const avg = searchParams.get("avg") ?? "0"
  const total = searchParams.get("total") ?? "0"
  const best = searchParams.get("best") ?? "-"
  const worst = searchParams.get("worst") ?? "-"
  const spiciest = (searchParams.get("spiciest") ?? "").slice(0, 120)
  const range = searchParams.get("range") ?? ""
  const username = searchParams.get("u") ?? "kamu"

  const { unboundedBold, jakartaMedium } = await loadFonts(req.url)

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#F4EFE6",
          padding: "80px 72px",
          fontFamily: "Jakarta",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "8px", background: "#FF4D1C", display: "flex" }} />

        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 28, letterSpacing: 6, color: "#C2350F", fontFamily: "Unbounded", fontWeight: 700, display: "flex" }}>
            RECAP MINGGU INI
          </div>
          <div style={{ fontSize: 24, color: "#8A8A92", fontFamily: "Jakarta", fontWeight: 500, display: "flex" }}>
            {range}
          </div>
        </div>

        {/* Skor besar + total */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
          <div style={{ fontSize: 200, color: "#0B0B0C", fontFamily: "Unbounded", fontWeight: 800, lineHeight: 1, display: "flex" }}>
            {avg}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 20 }}>
            <div style={{ fontSize: 30, color: "#8A8A92", fontFamily: "Jakarta", fontWeight: 500, display: "flex" }}>
              / 100 rata-rata
            </div>
            <div style={{ fontSize: 30, color: "#0B0B0C", fontFamily: "Jakarta", fontWeight: 700, display: "flex" }}>
              {total} roast minggu ini
            </div>
          </div>
        </div>

        {/* Best / worst */}
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ display: "flex", background: "#E6FF3A", color: "#0B0B0C", padding: "12px 20px", fontSize: 26, fontFamily: "Unbounded", fontWeight: 700 }}>
            TERBAIK: {best.toUpperCase()}
          </div>
          <div style={{ display: "flex", background: "#FF4D1C", color: "#F4EFE6", padding: "12px 20px", fontSize: 26, fontFamily: "Unbounded", fontWeight: 700 }}>
            TERLEMAH: {worst.toUpperCase()}
          </div>
        </div>

        {/* Spiciest quote */}
        <div style={{ fontSize: 30, lineHeight: 1.35, color: "#17171A", fontFamily: "Jakarta", fontWeight: 500, fontStyle: "italic", display: "flex" }}>
          {spiciest ? `“${spiciest}…”` : ""}
        </div>

        <div style={{ width: "100%", height: "2px", background: "#D9D2C4", display: "flex" }} />

        {/* Watermark (WAJIB sama seperti card roast) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 28, color: "#0B0B0C", fontFamily: "Unbounded", fontWeight: 800, display: "flex" }}>
            RoastMyContent<span style={{ color: "#FF4D1C" }}>.com</span>
          </div>
          <div style={{ fontSize: 24, color: "#8A8A92", fontFamily: "Jakarta", display: "flex" }}>
            @{username}
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      fonts: [
        { name: "Unbounded", data: unboundedBold, weight: 800, style: "normal" },
        { name: "Jakarta", data: jakartaMedium, weight: 500, style: "normal" },
      ],
    }
  )
}
