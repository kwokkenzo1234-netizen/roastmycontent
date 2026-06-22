// Konfigurasi situs terpusat. Set NEXT_PUBLIC_SITE_URL di environment produksi
// (mis. https://roastmycontent.com). Fallback dipakai saat env belum diset.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://roastmycontent.com"

export const SITE_NAME = "RoastMyContent"

export const SITE_DESCRIPTION =
  "AI nonton video lo, terus ngehina kontennya secara jujur & lucu. Upload video konten lo, pilih karakter, dan dapat roast spesifik dalam 30 detik."
