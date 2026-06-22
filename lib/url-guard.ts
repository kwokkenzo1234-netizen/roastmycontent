import dns from "dns/promises"
import net from "net"

// Host yang sah dipakai UploadThing untuk menyimpan file.
// `utfs.io` = legacy, `*.ufs.sh` = format baru (file.ufsUrl).
const ALLOWED_UPLOAD_HOST_PATTERNS: readonly RegExp[] = [
  /(^|\.)utfs\.io$/i,
  /(^|\.)ufs\.sh$/i,
]

export function isAllowedUploadHost(hostname: string): boolean {
  return ALLOWED_UPLOAD_HOST_PATTERNS.some((re) => re.test(hostname))
}

// Cek apakah sebuah IP (v4/v6) menunjuk ke ruang internal/privat.
// Menangkap loopback, private ranges, link-local (termasuk cloud metadata
// 169.254.169.254), serta padanan IPv6-nya.
export function isPrivateIp(ip: string): boolean {
  const type = net.isIP(ip)
  if (type === 4) return isPrivateIpv4(ip)
  if (type === 6) return isPrivateIpv6(ip)
  // Bukan IP literal yang valid → perlakukan sebagai tidak aman.
  return true
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p))
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true
  }
  const [a, b] = parts
  if (a === 0) return true // 0.0.0.0/8
  if (a === 10) return true // 10.0.0.0/8
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64.0.0/10
  if (a >= 224) return true // multicast + reserved
  return false
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === "::" || lower === "::1") return true // unspecified + loopback

  // IPv4-mapped/compat (::ffff:a.b.c.d) → evaluasi sebagai IPv4.
  const mapped = lower.match(/(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIpv4(mapped[1])

  if (lower.startsWith("fe80")) return true // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true // unique-local fc00::/7
  return false
}

interface AssertSafeUrlOptions {
  // Wajib berada di host UploadThing (dipakai untuk URL awal dari client).
  requireUploadHost?: boolean
}

// Lempar error jika URL tidak aman untuk di-fetch server-side (anti-SSRF).
// Dipanggil pada URL awal DAN tiap hop redirect.
export async function assertSafeUrl(
  urlStr: string,
  options: AssertSafeUrlOptions = {}
): Promise<void> {
  let url: URL
  try {
    url = new URL(urlStr)
  } catch {
    throw new Error("URL tidak valid")
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Protokol tidak diizinkan: ${url.protocol}`)
  }

  if (options.requireUploadHost && !isAllowedUploadHost(url.hostname)) {
    throw new Error("Host file tidak diizinkan")
  }

  // Jika hostname sudah berupa IP literal, cek langsung.
  if (net.isIP(url.hostname)) {
    if (isPrivateIp(url.hostname)) {
      throw new Error("URL menunjuk ke alamat internal")
    }
    return
  }

  // Resolve DNS → tolak bila ADA satu pun IP yang menunjuk internal.
  const records = await dns.lookup(url.hostname, { all: true })
  if (records.length === 0) {
    throw new Error("Host tidak dapat di-resolve")
  }
  for (const { address } of records) {
    if (isPrivateIp(address)) {
      throw new Error("URL menunjuk ke alamat internal")
    }
  }
}
