import { GoogleGenerativeAI, GenerateContentResult } from "@google/generative-ai"
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server"
import { getCharacter } from "./characters"

const MODEL = "gemini-3.1-flash-lite"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!)

export type RoastErrorCode =
  | "BLOCKED" // konten kena filter keamanan (video/teks inappropriate)
  | "RATE_LIMIT" // kuota / rate limit Gemini (429)
  | "UPSTREAM_DOWN" // Google AI down / overloaded (5xx)
  | "PROCESSING_FAILED" // gagal proses video (selain di atas)

// Error terklasifikasi → route bisa kasih pesan & status HTTP yang tepat.
export class RoastError extends Error {
  code: RoastErrorCode
  constructor(code: RoastErrorCode, message: string) {
    super(message)
    this.name = "RoastError"
    this.code = code
  }
}

// Ambil teks respons Gemini, TAPI deteksi dulu kalau diblokir filter keamanan.
// Tanpa ini, .text() bisa throw/return kosong → user dapat error misterius.
function extractTextOrThrow(result: GenerateContentResult): string {
  const resp = result.response
  const blockReason = resp?.promptFeedback?.blockReason
  if (blockReason) {
    throw new RoastError("BLOCKED", `Input diblokir filter: ${blockReason}`)
  }
  const finish = resp?.candidates?.[0]?.finishReason
  if (finish && String(finish) !== "STOP" && String(finish) !== "MAX_TOKENS") {
    // SAFETY, RECITATION, OTHER, dll → anggap tidak bisa diproses.
    throw new RoastError("BLOCKED", `Respons dihentikan: ${finish}`)
  }
  return resp?.text?.() ?? ""
}

// Bedakan error 429 (kuota penuh) dari 5xx (Google down) dari sisanya.
function classifyGeminiError(err: unknown): RoastError {
  const status = (err as { status?: number })?.status
  const msg = err instanceof Error ? err.message : String(err)
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit|too many request/i.test(msg)) {
    return new RoastError("RATE_LIMIT", "Kuota AI lagi penuh.")
  }
  if (
    status === 503 ||
    status === 500 ||
    /UNAVAILABLE|overloaded|internal error|deadline|\b50[0-9]\b/i.test(msg)
  ) {
    return new RoastError("UPSTREAM_DOWN", "Server AI lagi bermasalah.")
  }
  return new RoastError("PROCESSING_FAILED", "Gagal memproses video.")
}

// Log token nyata (usageMetadata) dari semua pass → dasar estimasi biaya/request.
// Video dikirim 2x (analisis + roast), jadi token video dihitung 2x juga.
function logTokenUsage(...results: GenerateContentResult[]): void {
  let input = 0
  let output = 0
  let total = 0
  for (const r of results) {
    const u = r.response?.usageMetadata
    if (!u) continue
    input += u.promptTokenCount ?? 0
    output += u.candidatesTokenCount ?? 0
    total += u.totalTokenCount ?? 0
  }
  console.log(`[gemini] token usage — input=${input} output=${output} total=${total}`)
}

export async function roastVideo(
  videoBuffer: Buffer,
  mimeType: string,
  characterId: string,
  userContext = ""
) {
  // Nama file Gemini di-hoist supaya selalu dibersihkan di finally (termasuk
  // saat video diblokir / error di tengah jalan).
  let uploadedName: string | null = null
  try {
    // Upload video ke Gemini File API
    const upload = await fileManager.uploadFile(videoBuffer, {
      mimeType,
      displayName: `roast-${Date.now()}`,
    })
    uploadedName = upload.file.name

    // Tunggu video selesai diproses
    let file = await fileManager.getFile(upload.file.name)
    while (file.state === FileState.PROCESSING) {
      await new Promise((r) => setTimeout(r, 2000))
      file = await fileManager.getFile(upload.file.name)
    }
    if (file.state === FileState.FAILED) {
      throw new RoastError("PROCESSING_FAILED", "Gemini gagal memproses video")
    }

    const model = genAI.getGenerativeModel({ model: MODEL })
    const videoData = { fileData: { fileUri: file.uri, mimeType: file.mimeType } }

    // PASS 1: Analisis video — dapat gender + age + category scores
    const analysisPrompt = buildAnalysisPrompt(userContext)
    const analysisResult = await model.generateContent([videoData, { text: analysisPrompt }])
    const analysisRaw = extractTextOrThrow(analysisResult).replace(/```json|```/g, "").trim()

    let analysis = null
    let gender = "unknown"
    let ageRange = "unknown"
    let categoryScores: Record<string, number> = {}

    try {
      analysis = JSON.parse(analysisRaw)
      gender = analysis?.estimated_gender ?? "unknown"
      ageRange = analysis?.estimated_age_range ?? "unknown"
      categoryScores = analysis?.category_scores ?? {}
    } catch {
      // fallback: lanjut dengan default
    }

    // PASS 2: Roast + badge sinkron dengan score (extractTextOrThrow tetap dipakai
    // supaya video yang keblok filter tetap ke-deteksi, bukan dapat JSON kosong).
    const roastPrompt = buildRoastPrompt(characterId, userContext, gender, ageRange, categoryScores)
    const roastResult = await model.generateContent([videoData, { text: roastPrompt }])
    const roastRaw = extractTextOrThrow(roastResult).replace(/```json|```/g, "").trim()

    let roastText = roastRaw
    let badgeNegative: string | null = null
    let badgePositive: string | null = null

    try {
      const roastParsed = JSON.parse(roastRaw)
      roastText = roastParsed.roast ?? roastRaw
      badgeNegative = roastParsed.badge_negative ?? null
      badgePositive = roastParsed.badge_positive ?? null
    } catch {
      // fallback: pakai raw text sebagai roast, badge null
    }

    // Catat token nyata (analisis + roast) buat estimasi biaya per request.
    logTokenUsage(analysisResult, roastResult)

    return {
      analysis,
      roast: roastText,
      badges: {
        negative: badgeNegative,
        positive: badgePositive,
      },
    }
  } catch (err) {
    // BLOCKED / PROCESSING_FAILED (dari extract/state) diteruskan apa adanya;
    // error mentah dari SDK Gemini diklasifikasikan (429 vs server down).
    if (err instanceof RoastError) throw err
    throw classifyGeminiError(err)
  } finally {
    // Selalu hapus file dari Gemini — termasuk saat diblokir.
    if (uploadedName) fileManager.deleteFile(uploadedName).catch(() => {})
  }
}

// Prompt pass 1: analisis saja
function buildAnalysisPrompt(userContext: string) {
  const contextBlock = userContext?.trim()
    ? `\n\nKONTEKS TAMBAHAN:\n"${userContext.trim()}"`
    : ""

  return `Analisis video ini secara detail.${contextBlock}

Beri score objektif (1-100) untuk 10 kategori berikut:
- hook: kekuatan 3 detik pembuka
- editing: kualitas cut, transisi, pacing visual
- audio: kejernihan suara, kualitas mic
- delivery: cara bicara, energi, kepercayaan diri
- visual: lighting, framing, komposisi
- script: kejelasan pesan, struktur konten
- pacing: tempo keseluruhan video
- originality: keunikan ide/angle
- cta: kejelasan call-to-action
- relatability: seberapa relate ke audiens target

Balas HANYA dengan JSON valid, tanpa markdown, tanpa backtick:
{
  "transcript": "string",
  "weak_points": ["string", "string", "string"],
  "estimated_gender": "male | female | unknown",
  "estimated_age_range": "teen | young_adult | adult | senior | unknown",
  "category_scores": {
    "hook": number,
    "editing": number,
    "audio": number,
    "delivery": number,
    "visual": number,
    "script": number,
    "pacing": number,
    "originality": number,
    "cta": number,
    "relatability": number
  }
}`
}

// Prompt pass 2: roast dengan karakter + profil + score, minta 2 badge sinkron
function buildRoastPrompt(
  characterId: string,
  userContext: string,
  gender: string,
  ageRange: string,
  categoryScores: Record<string, number>
) {
  const character = getCharacter(characterId)
  if (!character) throw new Error("Karakter tidak ditemukan")

  const contextBlock = userContext?.trim()
    ? `\n\nKONTEKS TAMBAHAN DARI CREATOR:\n"${userContext.trim()}"`
    : ""

  const scoresBlock = Object.entries(categoryScores)
    .map(([key, val]) => `- ${key}: ${val}/100`)
    .join("\n")

  return `Kamu akan me-roast konten creator ini.

PROFIL CREATOR:
- Gender: ${gender}
- Estimasi umur: ${ageRange}${contextBlock}

SCORE OBJEKTIF PER KATEGORI (hasil analisis video):
${scoresBlock}

Roast sebagai karakter berikut:

${character.systemPrompt}

SETELAH menulis roast, tentukan 2 badge berdasarkan LOGIKA INI:
- badge_negative: kategori dengan score TERENDAH yang JUGA kamu singgung/kritik di roast kamu. Kalau kategori terendah TIDAK kamu singgung di roast, pilih kategori terendah berikutnya yang KAMU SINGGUNG.
- badge_positive: kategori dengan score TERTINGGI yang TIDAK kamu kritik negatif di roast kamu. Kalau roast kamu mengkritik kategori dengan score tinggi (kamu salah/bias), JANGAN pilih itu — pilih kategori tertinggi lain yang aman/tidak dikritik.
- Tujuannya: badge harus selalu konsisten dengan apa yang kamu bilang di roast, bukan kontradiksi.

Balas HANYA dengan JSON valid, tanpa markdown, tanpa backtick:
{
  "roast": "string (teks roast lengkap dalam karakter)",
  "badge_negative": "string (nama kategori, contoh: hook)",
  "badge_positive": "string (nama kategori, contoh: visual)"
}`
}
