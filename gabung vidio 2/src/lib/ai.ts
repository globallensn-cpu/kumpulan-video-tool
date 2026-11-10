// ============================================================
// TokForge — Integrasi AI (z-ai-web-dev-sdk, backend only)
// 1. analyzeVideoContent : video understanding (createVision)
//    dengan fallback analisis keyframes bila video gagal
// 2. generateTikTokMetadata : LLM strategist TikTok SEO
// ============================================================

import ZAI from "z-ai-web-dev-sdk"
import { execFile } from "child_process"
import { promisify } from "util"
import { mkdir, readFile, readdir, rm } from "fs/promises"
import path from "path"
import type { CreateChatCompletionVisionBody } from "z-ai-web-dev-sdk"
import type { TikTokMetadata } from "./types"

const execFileAsync = promisify(execFile)

// Batas waktu panggilan AI — model yang menggantung tidak boleh
// membekukan pipeline di tengah progres.
const ANALYSIS_TIMEOUT_MS = 180_000
const FRAMES_TIMEOUT_MS = 150_000
const METADATA_TIMEOUT_MS = 90_000

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} melebihi ${Math.round(ms / 1000)} detik — coba lagi`)),
      ms
    )
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    )
  })
}

type ZaiClient = Awaited<ReturnType<typeof ZAI.create>>

/**
 * Body vision SDK — properti `model` diisi otomatis oleh server gateway
 * (perilaku runtime SDK terverifikasi), sehingga opsional di sisi klien.
 */
type VisionBody = Omit<CreateChatCompletionVisionBody, "model"> & { model?: string }

// ------------------------------------------------------------
// Prompt analisis konten video
// ------------------------------------------------------------

const ANALYSIS_PROMPT = `Kamu adalah analis konten video untuk kreator TikTok Indonesia. Analisis video ini lalu jawab dalam Bahasa Indonesia dengan poin ringkas per kategori:

SUBJEK: siapa/apa yang tampil
SETTING: lokasi, waktu, suasana
AKSI: urutan kejadian dari awal sampai akhir
TEKS: tulisan yang terlihat di layar (jika ada)
MOOD: nuansa emosional
KATEGORI: niche konten (contoh: kuliner, wisata, edukasi, komedi, review, lifestyle, motovlog)
AUDIENCE: target penonton yang paling cocok

Fokus pada substansi konten. Jangan menilai kualitas editing atau resolusi.`

export async function analyzeVideoContent(proxyPath: string, durationSec: number): Promise<string> {
  const zai = await ZAI.create()
  try {
    const buf = await readFile(proxyPath)
    const b64 = buf.toString("base64")
    const body: VisionBody = {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: ANALYSIS_PROMPT },
            { type: "video_url", video_url: { url: `data:video/mp4;base64,${b64}` } },
          ],
        },
      ],
      thinking: { type: "disabled" },
    }
    const res = await withTimeout(
      zai.chat.completions.createVision(body as CreateChatCompletionVisionBody),
      ANALYSIS_TIMEOUT_MS,
      "Analisis video AI"
    )
    const content = res.choices[0]?.message?.content?.trim()
    if (content) return content
    throw new Error("Respons analisis kosong")
  } catch {
    // Fallback: ekstrak 6 keyframe → analisis sebagai gambar
    return analyzeWithFrames(zai, proxyPath, durationSec)
  }
}

async function analyzeWithFrames(zai: ZaiClient, proxyPath: string, durationSec: number): Promise<string> {
  const dir = path.join(path.dirname(proxyPath), "frames")
  await mkdir(dir, { recursive: true })
  const sampleFps = Math.max(0.1, 6 / Math.max(durationSec, 1))
  await execFileAsync("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    proxyPath,
    "-vf",
    `fps=${sampleFps.toFixed(4)}`,
    "-frames:v",
    "6",
    "-q:v",
    "4",
    path.join(dir, "f_%02d.jpg"),
  ])
  const files = (await readdir(dir))
    .filter((f) => f.endsWith(".jpg"))
    .sort()
  if (files.length === 0) throw new Error("Tidak dapat mengekstrak frame untuk analisis")
  try {
    const frameParts = await Promise.all(
      files.map(async (f) => {
        const b64 = (await readFile(path.join(dir, f))).toString("base64")
        return { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${b64}` } }
      })
    )
    const frameBody: VisionBody = {
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: ANALYSIS_PROMPT }, ...frameParts],
        },
      ],
      thinking: { type: "disabled" },
    }
    const res = await withTimeout(
      zai.chat.completions.createVision(frameBody as CreateChatCompletionVisionBody),
      FRAMES_TIMEOUT_MS,
      "Analisis frame AI"
    )
    const content = res.choices[0]?.message?.content?.trim()
    if (!content) throw new Error("Analisis frame kosong")
    return content
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

// ------------------------------------------------------------
// Prompt metadata SEO TikTok
// ------------------------------------------------------------

const METADATA_SYSTEM = `Kamu adalah strategist TikTok SEO dan copywriter viral asal Indonesia dengan 10 tahun pengalaman membantu kreator mencapai jutaan views.

Prinsip WAJIB yang kamu ikuti (berdasarkan riset algoritma TikTok):
- Watch time & completion rate adalah sinyal ranking terkuat → judul harus hook yang menarik di 3 detik pertama
- Keyword utama harus muncul di awal caption (dibaca NLP TikTok)
- TikTok membaca teks layar (OCR) dan audio (ASR) → saran overlay teks harus mengandung keyword
- Hashtag: 3-6 tag campuran broad + niche yang BENAR-BENAR relevan; DILARANG tag generik seperti fyp, viral, foryou
- Caption: 2-4 baris, keyword natural di kalimat pembuka, diakhiri pertanyaan CTA
- Semua dalam Bahasa Indonesia yang natural (boleh 1-2 istilah Inggris yang umum)

FORMAT JAWABAN: HANYA JSON valid — tanpa markdown, tanpa teks lain sebelum atau sesudah JSON.`

export interface MetadataContext {
  summary: string
  clipNames: string[]
  duration: number
  fps: number
  aspect: string
}

export async function generateTikTokMetadata(ctx: MetadataContext): Promise<TikTokMetadata> {
  const zai = await ZAI.create()

  const names = ctx.clipNames.map((n) => `- ${n}`).join("\n")
  const userPrompt = `Konteks: video hasil penggabungan ${ctx.clipNames.length} klip, total ${Math.round(
    ctx.duration
  )} detik, vertikal 9:16 1080×1920, ${ctx.fps} fps.

HASIL ANALISIS VIDEO:
${ctx.summary || "(analisis tidak tersedia — pakai nama file sebagai petunjuk konten)"}

NAMA FILE KLIP (urutan tampil):
${names}

Buat metadata siap upload dengan struktur JSON persis seperti ini:
{
  "title": "judul hook maksimal 90 karakter, keyword utama di bagian depan",
  "caption": "caption 2-4 baris (pakai \\n untuk baris baru), kalimat pertama mengandung keyword utama, akhiri dengan pertanyaan CTA",
  "hashtags": ["3 sampai 6 hashtag tanpa tanda #, campuran broad dan niche, semuanya relevan dengan konten"],
  "keywords": ["8-12 frasa keyword pencarian yang mungkin diketik orang di TikTok search"],
  "overlays": ["tepat 3 teks overlay untuk ditampilkan di layar, masing-masing maksimal 6 kata, mengandung keyword"],
  "seoTips": ["3 tips spesifik untuk video ini agar performanya lebih baik"],
  "seoScore": 75
}

seoScore = estimasi angka 60-100 seberapa siap video + metadata ini bersaing di pencarian TikTok.`

  let lastError = "Respons AI tidak valid"
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await withTimeout(
      zai.chat.completions.create({
        messages: [
          { role: "assistant", content: METADATA_SYSTEM },
          {
            role: "user",
            content:
              attempt === 0
                ? userPrompt
                : `${userPrompt}\n\nPENTING: Balas HANYA dengan JSON valid, tanpa kalimat pembuka apa pun.`,
          },
        ],
        thinking: { type: "disabled" },
      }),
      METADATA_TIMEOUT_MS,
      "Metadata SEO AI"
    )
    const raw = completion.choices[0]?.message?.content ?? ""
    const parsed = extractJson(raw)
    if (parsed) {
      const normalized = normalizeMetadata(parsed)
      if (normalized) return normalized
      lastError = "Struktur JSON tidak lengkap"
    }
  }
  throw new Error(lastError)
}

function extractJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

function toStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => String(x ?? "").replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, max)
}

function normalizeMetadata(obj: Record<string, unknown>): TikTokMetadata | null {
  const title = String(obj.title ?? "").trim()
  const caption = String(obj.caption ?? "").trim()
  // Riset: TikTok paling efektif dengan 3-6 hashtag — potong ke 6 maksimal
  const hashtags = toStringArray(obj.hashtags, 6)
  if (!title || !caption || hashtags.length === 0) return null
  const score = Number(obj.seoScore)
  return {
    title: title.slice(0, 150),
    caption: caption.slice(0, 2200),
    hashtags,
    keywords: toStringArray(obj.keywords, 14),
    overlays: toStringArray(obj.overlays, 5),
    seoTips: toStringArray(obj.seoTips, 5),
    seoScore: Number.isFinite(score) ? Math.min(100, Math.max(0, Math.round(score))) : 75,
  }
}

/** Metadata darurat bila AI gagal total — pipeline tetap selesai */
export function fallbackMetadata(clipNames: string[], duration: number): TikTokMetadata {
  const first = (clipNames[0] ?? "video")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim()
  const base = first.length > 0 ? first : "Video gabungan"
  return {
    title: `${base} — tonton sampai habis!`.slice(0, 90),
    caption: `${base}\n\nVideo gabungan ${
      duration < 60 ? "singkat" : "menarik"
    } ini wajib kamu tonton sampai akhir! Suka konten seperti ini? Follow untuk video berikutnya 👇`,
    hashtags: ["kontenkreator", "kreatorindonesia", "videoGabungan", "kontenmenarik"],
    keywords: [base.toLowerCase(), "video gabungan", "konten kreator indonesia", "video menarik"],
    overlays: ["Tonton sampai habis!", "Jangan lewatkan!", "Follow untuk selanjutnya"],
    seoTips: [
      "Metadata AI gagal dibuat — edit manual dengan keyword niche kontenmu",
      "Sebutkan topik utama secara lisan di 3 detik pertama video",
      "Tambahkan 3-6 hashtag yang spesifik dengan niche kamu",
    ],
    seoScore: 55,
  }
}
