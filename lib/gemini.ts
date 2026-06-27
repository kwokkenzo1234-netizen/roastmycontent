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
  userContext = "",
  recentAverage: number | null = null
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
    const roastPrompt = buildRoastPrompt(characterId, userContext, gender, ageRange, categoryScores, recentAverage)
    const roastResult = await model.generateContent([videoData, { text: roastPrompt }])
    const roastRaw = extractTextOrThrow(roastResult).replace(/```/g, "").trim()

    let roastText = roastRaw
    let badgeNegative: string | null = null
    let badgePositive: string | null = null

    // Format baru: teks roast bebas + blok "===BADGE===" berisi baris
    // negatif/positif. Jauh lebih tahan-banting dari JSON — teks roast yang
    // panjang/ada kutip/multi-baris gak perlu di-escape, jadi gak gampang
    // bikin parse gagal & nampilin "JSON mentah" ke user (bug Mentor Jujur).
    const delimIdx = roastRaw.search(/===\s*BADGE\s*===/i)
    if (delimIdx !== -1) {
      roastText = roastRaw.slice(0, delimIdx).trim()
      const badgeBlock = roastRaw.slice(delimIdx)
      badgeNegative = badgeBlock.match(/negatif\s*:\s*([a-z_]+)/i)?.[1]?.toLowerCase() ?? null
      badgePositive = badgeBlock.match(/positif\s*:\s*([a-z_]+)/i)?.[1]?.toLowerCase() ?? null
    } else if (roastRaw.startsWith("{")) {
      // Fallback: kalau model malah balikin JSON lama, salvage roast-nya biar
      // gak pernah nampilin JSON mentah ke user.
      try {
        const parsed = JSON.parse(roastRaw)
        roastText = parsed.roast ?? roastText
        badgeNegative = parsed.badge_negative ?? null
        badgePositive = parsed.badge_positive ?? null
      } catch {
        // biarin raw text apa adanya
      }
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
  categoryScores: Record<string, number>,
  recentAverage: number | null = null
) {
  const character = getCharacter(characterId)
  if (!character) throw new Error("Karakter tidak ditemukan")

  const contextBlock = userContext?.trim()
    ? `\n\nKONTEKS TAMBAHAN DARI CREATOR:\n"${userContext.trim()}"`
    : ""

  const scoresBlock = Object.entries(categoryScores)
    .map(([key, val]) => `- ${key}: ${val}/100`)
    .join("\n")

  // Adaptive tone (Bagian 4): rata-rata skor sekarang vs rata-rata roast terakhir
  // user. Naik >10 → HYPE MODE; turun >10 → ROAST MODE; selain itu tone normal.
  const scoreValues = Object.values(categoryScores)
  const currentAverage =
    scoreValues.length > 0 ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length : 0

  let toneInstruction = ""
  if (recentAverage !== null && scoreValues.length > 0) {
    const improvement = currentAverage - recentAverage
    if (improvement > 10) {
      toneInstruction = `\n\nADAPTIVE TONE: Skor user MENINGKAT signifikan dari roast-roast sebelumnya (dari ${recentAverage.toFixed(0)} ke ${currentAverage.toFixed(0)}). Masuk ke "HYPE MODE" — tetap dalam karakter, tapi nada lebih suportif dan mengapresiasi progress, meski tetap ada sedikit roast untuk konsistensi karakter. Beri pengakuan eksplisit bahwa dia membaik.`
    } else if (improvement < -10) {
      toneInstruction = `\n\nADAPTIVE TONE: Skor user MENURUN dari roast-roast sebelumnya (dari ${recentAverage.toFixed(0)} ke ${currentAverage.toFixed(0)}). Masuk ke "ROAST MODE" — lebih pedas dari biasanya, tapi tetap dalam karakter, bukan kejam tanpa alasan.`
    }
  }

  return `Kamu akan me-roast konten creator ini.

PROFIL CREATOR:
- Gender: ${gender}
- Estimasi umur: ${ageRange}${contextBlock}

SCORE OBJEKTIF PER KATEGORI (hasil analisis video):
${scoresBlock}${toneInstruction}

Roast sebagai karakter berikut:

${character.systemPrompt}

SETELAH menulis roast, tentukan 2 badge berdasarkan LOGIKA INI:
- badge negatif: kategori dengan score TERENDAH yang JUGA kamu singgung/kritik di roast kamu. Kalau kategori terendah TIDAK kamu singgung di roast, pilih kategori terendah berikutnya yang KAMU SINGGUNG.
- badge positif: kategori dengan score TERTINGGI yang TIDAK kamu kritik negatif di roast kamu. Kalau roast kamu mengkritik kategori dengan score tinggi (kamu salah/bias), JANGAN pilih itu — pilih kategori tertinggi lain yang aman/tidak dikritik.
- Tujuannya: badge harus selalu konsisten dengan apa yang kamu bilang di roast, bukan kontradiksi.

FORMAT OUTPUT — WAJIB diikuti persis. JANGAN pakai JSON, JANGAN pakai markdown/backtick:
Tulis teks roast lengkap dulu (dalam karakter, bebas, boleh beberapa baris).
Lalu di baris baru, tulis blok ini PERSIS:
===BADGE===
negatif: <nama_kategori>
positif: <nama_kategori>

<nama_kategori> HARUS salah satu dari: hook, editing, audio, delivery, visual, script, pacing, originality, cta, relatability.`
}
