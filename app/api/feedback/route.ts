import { NextRequest, NextResponse } from "next/server"
import { checkFeedbackRateLimit } from "@/lib/rate-limit"
import { supabaseAdmin } from "@/lib/supabase"

// Batas panjang input (anti-abuse + jaga ukuran DB).
const MAX_MESSAGE_CHARS = 1000
const MAX_CONTACT_CHARS = 200

// Ambil IP dari request (works di Vercel & lokal). Sama seperti route roast.
function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  )
}

interface FeedbackBody {
  message?: unknown
  contact?: unknown
  website?: unknown // honeypot — harus kosong; diisi = bot
}

export async function POST(req: NextRequest) {
  try {
    let body: FeedbackBody
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Body tidak valid." }, { status: 400 })
    }

    // Honeypot: field tersembunyi yang hanya bot isi. Pura-pura sukses biar
    // bot tidak tahu terdeteksi, tapi tidak menulis apa pun ke DB.
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return NextResponse.json({ ok: true })
    }

    // Validasi message (wajib).
    const message = typeof body.message === "string" ? body.message.trim() : ""
    if (message.length === 0) {
      return NextResponse.json({ error: "Feedback-nya kosong." }, { status: 400 })
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json(
        { error: `Kepanjangan. Max ${MAX_MESSAGE_CHARS} karakter.` },
        { status: 400 }
      )
    }

    // Contact opsional.
    const contactRaw = typeof body.contact === "string" ? body.contact.trim() : ""
    const contact = contactRaw.slice(0, MAX_CONTACT_CHARS) || null

    // Rate limit per IP (counter terpisah dari roast).
    const ip = getIP(req)
    const rateLimit = await checkFeedbackRateLimit(ip)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Udah cukup feedback hari ini. Makasih ya, balik lagi besok." },
        { status: 429 }
      )
    }

    const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null

    const { error } = await supabaseAdmin.from("feedback").insert({
      message,
      contact,
      user_agent: userAgent,
      ip,
    })

    if (error) {
      console.error("[feedback] insert error:", error)
      return NextResponse.json({ error: "Yah gagal kirim. Coba lagi." }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[feedback] error:", err)
    return NextResponse.json({ error: "Yah error. Coba lagi sebentar." }, { status: 500 })
  }
}
