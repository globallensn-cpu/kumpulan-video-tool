import { createWriteStream } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"

import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/db"
import {
  ALLOWED_EXT,
  MAX_AGE_MS,
  cleanupOldData,
  newId,
  probeVideo,
  videoDir,
} from "@/lib/video-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_SIZE = 500 * 1024 * 1024 // 500 MB
const MAX_NAME_LEN = 255
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000 // 10 menit batas atas unggah

/**
 * Validasi nama file: tolak null byte, path traversal, dan nama kosong.
 * Panjang dibatasi agar aman ditulis ke filesystem.
 */
function sanitizeName(raw: string): string | null {
  if (!raw) return null
  // buang null byte & kontrol
  const cleaned = raw.replace(/[\x00-\x1f\x7f]/g, "").trim()
  if (!cleaned) return null
  // ambil basename saja (anti traversal)
  const base = path.basename(cleaned)
  if (!base || base === "." || base === "..") return null
  if (base.length > MAX_NAME_LEN) return null
  return base
}

export async function POST(req: NextRequest) {
  // cleanup ringan: jalankan sekali per request, aman terhadap concurrency
  // karena hanya menghapus folder yang mtime-nya > 3 jam.
  void cleanupOldData().catch(() => {})

  // ---- pre-check ukuran dari Content-Length ----
  // Tolak early sebelum streaming dimulai agar tidak membuang bandwidth.
  const clHeader = req.headers.get("content-length")
  if (clHeader) {
    const cl = Number(clHeader)
    if (Number.isFinite(cl) && cl > MAX_SIZE) {
      return NextResponse.json(
        {
          ok: false,
          error: `Ukuran file (${(cl / (1024 * 1024)).toFixed(1)} MB) melebihi batas 500 MB.`,
        },
        { status: 413 }
      )
    }
  }

  // ---- nama file ----
  let originalName = "video"
  const rawName = req.headers.get("x-filename")
  if (rawName) {
    let decoded = rawName
    try {
      decoded = decodeURIComponent(rawName)
    } catch {
      // biarkan raw
    }
    const safe = sanitizeName(decoded)
    if (safe) originalName = safe
  }

  const ext = path.extname(originalName).toLowerCase()
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Format file tidak didukung. Gunakan MP4, MOV, MKV, WEBM, AVI, dan sejenisnya.",
      },
      { status: 400 }
    )
  }

  if (!req.body) {
    return NextResponse.json(
      { ok: false, error: "Body permintaan kosong." },
      { status: 400 }
    )
  }

  const id = newId()
  const dir = videoDir(id)
  const inputPath = path.join(dir, `input${ext}`)

  // ---- streaming ke disk dengan pengaman ukuran & timeout ----
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch {
    return NextResponse.json(
      { ok: false, error: "Gagal menyiapkan penyimpanan server." },
      { status: 500 }
    )
  }

  let totalWritten = 0
  let aborted = false
  const writeStream = createWriteStream(inputPath)
  // batasi ukuran saat menulis: jika melebihi MAX_SIZE, hentikan & tandai abort
  const sizeLimited = new WritableStream<Uint8Array>({
    write(chunk) {
      totalWritten += chunk.byteLength
      if (totalWritten > MAX_SIZE) {
        aborted = true
        // batalkan pipeline dengan throw
        throw new Error("UPLOAD_TOO_LARGE")
      }
      return new Promise<void>((resolve, reject) => {
        writeStream.write(Buffer.from(chunk), (err) =>
          err ? reject(err) : resolve()
        )
      })
    },
    close() {
      return new Promise<void>((resolve) => writeStream.end(() => resolve()))
    },
    abort(reason) {
      writeStream.destroy(typeof reason === "string" ? new Error(reason) : undefined)
    },
  })

  const nodeStream = Readable.fromWeb(req.body as ReadableStream<Uint8Array>)

  // timeout absolut: putuskan bila unggah macet > 10 menit
  const timer = setTimeout(() => {
    aborted = true
    nodeStream.destroy(new Error("UPLOAD_TIMEOUT"))
  }, UPLOAD_TIMEOUT_MS)

  try {
    await pipeline(nodeStream, sizeLimited)
  } catch (err) {
    clearTimeout(timer)
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
    if (aborted) {
      return NextResponse.json(
        { ok: false, error: "Ukuran file melebihi batas 500 MB atau unggah terlalu lama." },
        { status: 413 }
      )
    }
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error && err.message
            ? `Gagal menyimpan file ke server: ${err.message}`
            : "Gagal menyimpan file ke server.",
      },
      { status: 500 }
    )
  }
  clearTimeout(timer)

  // ---- verifikasi file hasil ----
  const stat = await fs.stat(inputPath).catch(() => null)
  if (!stat || stat.size === 0) {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
    return NextResponse.json(
      { ok: false, error: "File kosong atau gagal terunggah." },
      { status: 400 }
    )
  }
  if (stat.size > MAX_SIZE) {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
    return NextResponse.json(
      { ok: false, error: "Ukuran file melebihi batas 500 MB." },
      { status: 413 }
    )
  }

  // ---- probe FFmpeg ----
  let probed
  try {
    probed = await probeVideo(inputPath)
  } catch {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
    return NextResponse.json(
      {
        ok: false,
        error:
          "File tidak dapat dibaca sebagai video. Mungkin rusak atau formatnya tidak didukung.",
      },
      { status: 400 }
    )
  }

  // ---- simpan metadata ----
  // Bila DB gagal, hapus file & laporkan error agar klien tahu unggah gagal total
  // (bukan menyajikan ilusi sukses yang nanti membuat /api/split 404).
  try {
    await db.video.create({
      data: {
        id,
        originalName,
        ext,
        size: stat.size,
        duration: probed.duration,
        width: probed.width,
        height: probed.height,
        hasAudio: probed.hasAudio,
      },
    })
  } catch {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
    return NextResponse.json(
      { ok: false, error: "Server sedang sibuk. Silakan coba beberapa saat lagi." },
      { status: 503 }
    )
  }

  return NextResponse.json({
    ok: true,
    video: {
      id,
      originalName,
      size: stat.size,
      duration: probed.duration,
      width: probed.width,
      height: probed.height,
      hasAudio: probed.hasAudio,
    },
  })
}

/** Health check sederhana: durasi retensi data. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "potongvideo-upload",
    maxAgeMs: MAX_AGE_MS,
    maxSize: MAX_SIZE,
  })
}
