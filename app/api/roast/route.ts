import { NextRequest, NextResponse } from "next/server"
import { roastVideo, RoastError, type RoastErrorCode } from "@/lib/gemini"
import { checkRateLimit, checkGlobalRoastCap } from "@/lib/rate-limit"
import { assertSafeUrl } from "@/lib/url-guard"
import { getWeekendCharacter, characters, weekendCharacters, WEEKEND_TEST_MODE } from "@/lib/characters"
import { UTApi } from "uploadthing/server"
import https from "https"
import http from "http"
import { URL } from "url"

export const maxDuration = 60

const utapi = new UTApi()

// Tipe video yang didukung Gemini & diizinkan masuk.
const ALLOWED_VIDEO_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/mpeg",
  "video/3gpp",
])

// Batas panjang konteks dari user (anti prompt-abuse + hemat token).
const MAX_CONTEXT_CHARS = 500

async function fetchBuffer(
  urlStr: string,
  maxRedirects = 5,
  requireUploadHost = false
): Promise<Buffer> {
  if (maxRedirects < 0) {
    throw new Error("Too many redirects")
  }

  // Anti-SSRF: validasi tiap hop (URL awal + setiap redirect).
  await assertSafeUrl(urlStr, { requireUploadHost })

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr)
    const client = parsedUrl.protocol === "https:" ? https : http

    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*"
      }
    }

    const req = client.get(urlStr, options, (res) => {
      const { statusCode } = res
      
      // Handle redirects
      if (statusCode && [301, 302, 303, 307, 308].includes(statusCode)) {
        const location = res.headers.location
        if (location) {
          const nextUrl = new URL(location, urlStr).toString()
          fetchBuffer(nextUrl, maxRedirects - 1).then(resolve).catch(reject)
          return
        }
      }

      if (statusCode !== 200) {
        reject(new Error(`Failed to fetch file: status code ${statusCode}`))
        return
      }

      const chunks: Buffer[] = []
      res.on("data", (chunk) => {
        chunks.push(chunk)
      })
      res.on("end", () => {
        resolve(Buffer.concat(chunks))
      })
      res.on("error", (err) => {
        reject(err)
      })
    })

    req.on("error", (err) => {
      reject(err)
    })
    
    // Timeout fetch HARUS lebih kecil dari maxDuration (60s) supaya gagal
    // dengan rapi sebelum function di-kill paksa oleh platform.
    req.setTimeout(45000, () => {
      req.destroy()
      reject(new Error("Fetch video timeout (45s). Coba lagi atau pakai video lebih kecil."))
    })
  })
}

// Ambil IP dari request (works di Vercel & lokal)
function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  )
}

export async function POST(req: NextRequest) {
  // Hoisted supaya catch bisa hapus file UploadThing pada error (mis. video
  // inappropriate yang diblokir) — jangan tinggalin file nyangkut.
  let fileKey: string | null = null
  try {
    const ip = getIP(req)

    // 1. Cek rate limit
    const rateLimit = await checkRateLimit(ip)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Jatah roast lo hari ini habis (${5} roast/hari). Balik lagi besok.`,
          resetAt: rateLimit.resetAt,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimit.resetAt.toISOString(),
          },
        }
      )
    }

    let buffer: Buffer
    let mimeType: string
    let characterId: string
    let userContext: string = ""

    const contentType = req.headers.get("content-type") || ""
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      const file = formData.get("video") as File
      characterId = formData.get("characterId") as string
      userContext = (formData.get("context") as string) || ""

      if (!file) {
        return NextResponse.json({ error: "File video tidak ditemukan." }, { status: 400 })
      }
      if (!characterId) {
        return NextResponse.json({ error: "Pilih karakter dulu." }, { status: 400 })
      }

      const arrayBuffer = await file.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
      
      mimeType = file.type || (file.name.endsWith(".mov") ? "video/quicktime" : "video/mp4")
      console.log(`[roast] Direct upload received. Size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB`)
    } else {
      // 2. Parse body (JSON path for UploadThing)
      const body = await req.json()
      const { fileUrl, fileKey: key, characterId: charId, context: ctx = "" } = body
      fileKey = key
      characterId = charId
      userContext = ctx

      if (!fileUrl || !fileKey) {
        return NextResponse.json(
          { error: "File URL tidak ada. Upload dulu." },
          { status: 400 }
        )
      }
      if (!characterId) {
        return NextResponse.json(
          { error: "Pilih karakter dulu." },
          { status: 400 }
        )
      }

      // 3. Fetch video dari UploadThing URL → buffer
      console.log(`[roast] Fetching video dari UploadThing: ${fileUrl}`)
      const startFetch = Date.now()
      buffer = await fetchBuffer(fileUrl, 5, true)
      console.log(`[roast] Selesai fetch video dalam ${((Date.now() - startFetch) / 1000).toFixed(2)}s. Ukuran: ${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB`)

      // Detect MIME type dari URL/extension
      mimeType = fileUrl.includes(".mov") ? "video/quicktime" : "video/mp4"
    }

    // Validasi karakter (tolak id tak dikenal sebelum proses mahal).
    // Karakter weekend hanya valid kalau memang sedang aktif (Jumat-Minggu WIB,
    // minggu yang tepat) — server-side gate, tidak percaya pada client.
    const isMainCharacter = characters.some((c) => c.id === characterId)
    // WEEKEND_TEST_MODE → terima semua karakter weekend (abaikan gating minggu).
    const isActiveWeekend = WEEKEND_TEST_MODE
      ? weekendCharacters.some((c) => c.id === characterId)
      : getWeekendCharacter()?.id === characterId
    if (!isMainCharacter && !isActiveWeekend) {
      if (fileKey) await utapi.deleteFiles(fileKey).catch(() => {})
      return NextResponse.json({ error: "Karakter tidak valid." }, { status: 400 })
    }

    // Validasi tipe video
    if (!ALLOWED_VIDEO_MIME.has(mimeType)) {
      if (fileKey) await utapi.deleteFiles(fileKey).catch(() => {})
      return NextResponse.json(
        { error: "Format video tidak didukung. Pakai MP4/MOV/WebM." },
        { status: 415 }
      )
    }

    // Batasi panjang konteks user
    userContext = userContext.slice(0, MAX_CONTEXT_CHARS)

    // Cek ukuran. 100MB: cukup untuk Reels 60fps, tapi tetap di bawah batas
    // memori/maxDuration fungsi & kuota UploadThing saat banyak request paralel.
    const MAX_BYTES = 100 * 1024 * 1024
    if (buffer.byteLength > MAX_BYTES) {
      // Hapus file dulu sebelum return error (jika pakai UploadThing)
      if (fileKey) {
        await utapi.deleteFiles(fileKey).catch(() => {})
      }
      return NextResponse.json(
        { error: "Video kegedean. Maksimal 100MB." },
        { status: 413 }
      )
    }

    // Cek cap GLOBAL tepat sebelum panggil Gemini — hanya request valid yang
    // dihitung. Kalau tembus, semua user lihat pesan kebanjiran sampai besok.
    const globalCap = await checkGlobalRoastCap()
    if (!globalCap.allowed) {
      if (fileKey) await utapi.deleteFiles(fileKey).catch(() => {})
      return NextResponse.json(
        {
          error: "Lagi kebanjiran roast hari ini 🌊 Servernya istirahat dulu, balik lagi besok ya!",
          resetAt: globalCap.resetAt,
        },
        { status: 503 }
      )
    }

    // 4. Proses roast via Gemini
    console.log("[roast] Mulai roastVideo via Gemini...")
    const startGemini = Date.now()
    const result = await roastVideo(buffer, mimeType, characterId, userContext)
    console.log(`[roast] Selesai roastVideo dalam ${((Date.now() - startGemini) / 1000).toFixed(2)}s`)

    // 5. Hapus file dari UploadThing setelah selesai diproses (hanya jika pakai UploadThing).
    // DI-AWAIT (bukan fire-and-forget): di serverless, function bisa di-freeze begitu
    // response terkirim, jadi promise yang gak di-await bisa gak kebagian jalan dan
    // file-nya nyangkut. Dibungkus try/catch supaya gagal hapus gak bikin response
    // error — kalau toh ketinggalan, cron cleanup yang nyapu (file >1 jam = yatim).
    if (fileKey) {
      try {
        await utapi.deleteFiles(fileKey)
      } catch (err) {
        console.error("[roast] gagal hapus UploadThing file:", err)
      }
    }

    // 6. Return hasil + info rate limit
    return NextResponse.json(
      {
        ...result,
        rateLimit: {
          remaining: rateLimit.remaining,
        },
      },
      {
        headers: {
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      }
    )
  } catch (err) {
    console.error("[roast] error:", err)

    // Bersihkan file UploadThing kalau masih nyangkut (mis. video diblokir).
    if (fileKey) await utapi.deleteFiles(fileKey).catch(() => {})

    if (err instanceof RoastError) {
      const map: Record<RoastErrorCode, { status: number; error: string }> = {
        BLOCKED: {
          status: 422,
          error: "Video lo gak bisa diproses — kemungkinan kena filter konten. Coba video lain ya.",
        },
        RATE_LIMIT: {
          status: 429,
          error: "Lagi rame banget, mesin roast-nya keteteran. Coba lagi bentar lagi.",
        },
        UPSTREAM_DOWN: {
          status: 503,
          error: "Mesin AI-nya lagi ngambek (server Google). Coba lagi sebentar.",
        },
        PROCESSING_FAILED: {
          status: 502,
          error: "Gagal proses videonya. Coba ulang atau pakai video lain.",
        },
      }
      const mapped = map[err.code]
      return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    }

    return NextResponse.json(
      { error: "Yah error. Coba lagi sebentar." },
      { status: 500 }
    )
  }
}
