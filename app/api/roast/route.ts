import { NextRequest, NextResponse } from "next/server"
import { roastVideo, RoastError, type RoastErrorCode } from "@/lib/gemini"
import {
  checkRateLimit,
  checkGlobalRoastCap,
  refundRateLimit,
  refundGlobalRoastCap,
} from "@/lib/rate-limit"
import { assertSafeUrl } from "@/lib/url-guard"
import { auth } from "@clerk/nextjs/server"
import { getRecentAverage, getUserNiche, saveRoast } from "@/lib/roast-history"
import { getWeekendCharacter, characters, weekendCharacters, WEEKEND_TEST_MODE } from "@/lib/characters"
import https from "https"
import http from "http"
import { URL } from "url"

export const maxDuration = 60

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
  // RESERVE + REFUND (#6): jatah di-reserve atomik di awal (nutup celah abuse
  // request paralel), lalu DIKEMBALIIN di finally kalau roast tidak berhasil —
  // jadi jatah cuma kepotong saat roast benar-benar sukses. UX adil, gak bisa
  // di-hack. `success` di-set true tepat sebelum return sukses.
  let ip = "unknown"
  // Identitas + flag login untuk rate-limit; disimpan di scope luar supaya
  // refund di finally pakai key yang PERSIS sama dengan saat reserve.
  let rlId = "unknown"
  let rlIsUser = false
  let ipReserved = false
  let globalReserved = false
  let success = false
  try {
    ip = getIP(req)
    // userId dari Clerk — null kalau belum login (roast tetap jalan, cuma gak
    // disimpan ke histori). Mempertahankan zero-friction roast pertama.
    const { userId } = await auth()

    // 1. Cek + reserve rate limit (atomik). Hybrid: login dibatasi per userId
    // (jatah lebih besar, lintas-device), anonim per IP. Identifier + flag login
    // disimpan ke scope luar supaya refund di finally pakai key yang sama.
    const identifier = userId ?? ip
    rlId = identifier
    rlIsUser = Boolean(userId)
    const rateLimit = await checkRateLimit(identifier, rlIsUser)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Jatah roast lo hari ini habis. Balik lagi besok.",
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
    ipReserved = true

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
      const { fileUrl, fileKey, characterId: charId, context: ctx = "" } = body
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
      return NextResponse.json({ error: "Karakter tidak valid." }, { status: 400 })
    }

    // Validasi tipe video
    if (!ALLOWED_VIDEO_MIME.has(mimeType)) {
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
      return NextResponse.json(
        { error: "Video kegedean. Maksimal 100MB." },
        { status: 413 }
      )
    }

    // Cek + reserve cap GLOBAL tepat sebelum panggil Gemini — hanya request
    // valid yang dihitung. Kalau tembus, semua user lihat pesan kebanjiran.
    const globalCap = await checkGlobalRoastCap()
    if (!globalCap.allowed) {
      return NextResponse.json(
        {
          error: "Lagi kebanjiran roast hari ini 🌊 Servernya istirahat dulu, balik lagi besok ya!",
          resetAt: globalCap.resetAt,
        },
        { status: 503 }
      )
    }
    globalReserved = true

    // 4. Proses roast via Gemini
    // Adaptive tone: rata-rata 3 roast terakhir user (kalau login) → tone HYPE/
    // ROAST mode tergantung tren skor (Bagian 4). Niche (dari onboarding) bikin
    // roast nyemplung ke konten user. Dua-duanya cuma untuk user login & diambil
    // paralel biar gak nambah latency berurutan.
    const [recentAverage, userNiche] = userId
      ? await Promise.all([getRecentAverage(userId), getUserNiche(userId)])
      : [null, null]

    console.log("[roast] Mulai roastVideo via Gemini...")
    const startGemini = Date.now()
    const result = await roastVideo(buffer, mimeType, characterId, userContext, recentAverage, userNiche)
    console.log(`[roast] Selesai roastVideo dalam ${((Date.now() - startGemini) / 1000).toFixed(2)}s`)

    // Sukses → jatah memang kepotong (TIDAK di-refund). File UploadThing
    // sengaja TIDAK dihapus di sini supaya "Roast Another" (karakter lain di
    // video yang sama) tetap jalan. Pembersihan dipindah ke client
    // (/api/cleanup-upload saat ganti video / mulai ulang) + cron harian.
    success = true

    // Simpan ke histori (kalau login & ada skor). Dibungkus try/catch supaya
    // kegagalan DB TIDAK bikin roast yang sudah sukses jadi error ke user.
    if (userId && result.analysis?.category_scores) {
      try {
        await saveRoast({
          userId,
          characterId,
          roastText: result.roast,
          categoryScores: result.analysis.category_scores as Record<string, number>,
          badgePositive: result.badges?.positive ?? null,
          badgeNegative: result.badges?.negative ?? null,
        })
      } catch (e) {
        console.error("[roast] gagal simpan histori:", e)
      }
    }

    // 5. Return hasil + info rate limit
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
  } finally {
    // Roast gagal/ditolak SETELAH slot di-reserve → kembaliin jatahnya, biar
    // user gak rugi jatah karena error/bug/close. Di-await supaya benar-benar
    // jalan sebelum function serverless di-freeze. Sukses → skip (jatah kepotong).
    if (!success) {
      if (ipReserved) await refundRateLimit(rlId, rlIsUser).catch(() => {})
      if (globalReserved) await refundGlobalRoastCap().catch(() => {})
    }
  }
}
