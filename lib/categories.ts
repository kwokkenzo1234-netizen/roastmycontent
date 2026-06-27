// 10 kategori skor konten. Key & urutan HARUS sama dengan analysisPrompt di
// lib/gemini.ts (sumber kebenaran skor). Dipakai halaman progress & recap untuk
// label Indonesia yang konsisten — biar gak ada drift label antar tempat.
export const CATEGORY_KEYS = [
  "hook",
  "editing",
  "audio",
  "delivery",
  "visual",
  "script",
  "pacing",
  "originality",
  "cta",
  "relatability",
] as const

export type CategoryKey = (typeof CATEGORY_KEYS)[number]

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  hook: "Hook",
  editing: "Editing",
  audio: "Audio",
  delivery: "Delivery",
  visual: "Visual",
  script: "Script",
  pacing: "Pacing",
  originality: "Originalitas",
  cta: "CTA",
  relatability: "Relatable",
}

// Label aman untuk key apa pun (fallback ke key mentah kalau tak dikenal).
export function categoryLabel(key: string): string {
  return (CATEGORY_LABELS as Record<string, string>)[key] ?? key
}

// Rata-rata semua skor kategori dari satu objek category_scores.
export function overallScore(scores: Record<string, number>): number {
  const vals = Object.values(scores ?? {})
  if (vals.length === 0) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
}
