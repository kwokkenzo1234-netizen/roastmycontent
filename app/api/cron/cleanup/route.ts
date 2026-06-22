import { NextRequest, NextResponse } from "next/server"
import { UTApi } from "uploadthing/server"

export const maxDuration = 60
export const dynamic = "force-dynamic" // jangan di-cache; selalu cek state terbaru

const utapi = new UTApi()

// Jaring pengaman buat abandoned upload: file yang ke-upload ke UploadThing tapi
// roast-nya gak pernah kelar (user refresh/tutup tab sebelum klik roast). Roast
// paling lama ~60 detik, jadi file yang umurnya >1 jam pasti yatim — aman dihapus.
const MAX_AGE_MS = 60 * 60 * 1000 // 1 jam
const PAGE_SIZE = 500

export async function GET(req: NextRequest) {
  // Auth: Vercel cron otomatis kirim "Authorization: Bearer <CRON_SECRET>" kalau
  // env CRON_SECRET di-set. Tolak siapa pun yang gak bawa secret yang benar.
  const auth = req.headers.get("authorization")
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = Date.now()
    const staleKeys: string[] = []
    let offset = 0

    // Page lewat semua file; kumpulin yang sudah lewat umur & masih "Uploaded".
    // "Deletion Pending"/"Uploading" dilewati biar gak dobel-hapus / ganggu in-flight.
    while (true) {
      const { files, hasMore } = await utapi.listFiles({ limit: PAGE_SIZE, offset })
      for (const file of files) {
        if (file.status === "Uploaded" && now - file.uploadedAt > MAX_AGE_MS) {
          staleKeys.push(file.key)
        }
      }
      if (!hasMore) break
      offset += PAGE_SIZE
    }

    if (staleKeys.length === 0) {
      return NextResponse.json({ deleted: 0 })
    }

    const result = await utapi.deleteFiles(staleKeys)
    console.log(`[cron/cleanup] hapus ${result.deletedCount} file yatim (>1 jam)`)
    return NextResponse.json({ deleted: result.deletedCount })
  } catch (err) {
    console.error("[cron/cleanup] error:", err)
    return NextResponse.json({ error: "Cleanup gagal" }, { status: 500 })
  }
}
