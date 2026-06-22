import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"

export const runtime = "edge"

// Convert markdown bold (*text*) jadi <span> bold beneran, bukan asterisk literal.
function parseMarkdownBold(text: string) {
  const parts = text.split(/(\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <span key={i} style={{ fontWeight: 800 }}>
          {part.slice(1, -1)}
        </span>
      )
    }
    return part
  })
}

// Load fonts for edge runtime
async function loadFonts(reqUrl: string) {
  const { origin } = new URL(reqUrl)
  try {
    const [unboundedBold, jakartaMedium, jakartaBold] = await Promise.all([
      fetch(new URL("/fonts/unbounded.ttf", origin)).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.arrayBuffer()
      }),
      fetch(new URL("/fonts/jakarta.ttf", origin)).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.arrayBuffer()
      }),
      fetch(new URL("/fonts/jakarta-bold.ttf", origin)).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.arrayBuffer()
      }),
    ])
    return { unboundedBold, jakartaMedium, jakartaBold }
  } catch (error) {
    console.warn("[og] Gagal memuat font lokal, fallback ke CDN:", error)
    const [unboundedBold, jakartaMedium, jakartaBold] = await Promise.all([
      fetch(
        "https://fonts.gstatic.com/s/unbounded/v12/Yq6F-LOTXCb04q32xlpat-6uR42XTqtG65j2040.ttf"
      ).then((r) => r.arrayBuffer()),
      fetch(
        "https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_m07NSg.ttf"
      ).then((r) => r.arrayBuffer()),
      fetch(
        "https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_Tkn9TR_Q.ttf"
      ).then((r) => r.arrayBuffer()),
    ])
    return { unboundedBold, jakartaMedium, jakartaBold }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const roast = searchParams.get("roast") ?? "Konten lo aman... kali ini."
  const character = searchParams.get("character") ?? "Mamah Dartini"
  const username = searchParams.get("u") ?? "kamu"

  const width = 1080
  const height = 1080

  const { unboundedBold, jakartaMedium, jakartaBold } = await loadFonts(req.url)

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
        {/* Top ember accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "8px",
            background: "#FF4D1C",
            display: "flex",
          }}
        />

        {/* Header: nama karakter */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              fontSize: 28,
              letterSpacing: 6,
              color: "#C2350F",
              fontFamily: "Unbounded",
              fontWeight: 700,
              display: "flex",
            }}
          >
            DIROAST OLEH
          </div>
          <div
            style={{
              fontSize: 56,
              color: "#0B0B0C",
              fontFamily: "Unbounded",
              fontWeight: 800,
              lineHeight: 1.1,
              display: "flex",
            }}
          >
            {character.toUpperCase()}
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            width: "100%",
            height: "2px",
            background: "#D9D2C4",
            display: "flex",
          }}
        />

        {/* Roast text */}
        <div
          style={{
            fontSize: 34,
            lineHeight: 1.35,
            color: "#0B0B0C",
            fontFamily: "Jakarta",
            fontWeight: 500,
            display: "flex",
            flex: 1,
            alignItems: "center",
            whiteSpace: "pre-wrap",
          }}
        >
          &ldquo;{parseMarkdownBold(roast)}&rdquo;
        </div>

        {/* Divider */}
        <div
          style={{
            width: "100%",
            height: "2px",
            background: "#D9D2C4",
            display: "flex",
          }}
        />

        {/* Footer: watermark (WAJIB) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: 28,
              color: "#0B0B0C",
              fontFamily: "Unbounded",
              fontWeight: 800,
              display: "flex",
            }}
          >
            RoastMyContent
            <span style={{ color: "#FF4D1C" }}>.com</span>
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#8A8A92",
              fontFamily: "Jakarta",
              display: "flex",
            }}
          >
            @{username}
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      fonts: [
        {
          name: "Unbounded",
          data: unboundedBold,
          weight: 800,
          style: "normal",
        },
        {
          name: "Jakarta",
          data: jakartaMedium,
          weight: 500,
          style: "normal",
        },
        {
          name: "Jakarta",
          data: jakartaBold,
          weight: 700,
          style: "normal",
        },
      ],
    }
  )
}
