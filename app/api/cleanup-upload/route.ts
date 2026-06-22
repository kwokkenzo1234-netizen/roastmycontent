import { NextRequest, NextResponse } from "next/server"
import { UTApi } from "uploadthing/server"

export const dynamic = "force-dynamic"

const utapi = new UTApi()

// Dipanggil client (sendBeacon) saat user SELESAI dengan sebuah video — ganti
// video atau mulai ulang — supaya file UploadThing langsung dibuang, bukan
// nunggu cron. File TIDAK lagi dihapus tiap habis roast (biar "Roast Another"
// di video yang sama tetap jalan), jadi pembersihan dipindah ke sini.
//
// Risiko "hapus file orang" minim: key UploadThing acak & cuma nunjuk file
// sementara milik upload itu sendiri. Cron cleanup harian tetap jadi backstop.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const fileKey = body?.fileKey
    if (typeof fileKey !== "string" || fileKey.length < 8 || fileKey.length > 256) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    await utapi.deleteFiles(fileKey).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
