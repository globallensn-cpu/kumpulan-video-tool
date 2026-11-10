// POST /api/upload — terima satu file video multipart, simpan ke storage,
// probe metadata via ffprobe, generate thumbnail, lalu persist ke DB.
// Mengembalikan ClipDTO agar langsung masuk ke state studio (frontend).

import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { createWriteStream } from "fs"
import { Readable } from "stream"
import type { ReadableStream as NodeWebReadableStream } from "stream/web"
import { open, rm } from "fs/promises"
import { pipeline } from "stream/promises"
import { db } from "@/lib/db"
import { toClipDTO } from "@/lib/dto"
import { makeThumbnail, probeVideo } from "@/lib/ffmpeg"
import { clipPath, ensureDirs, thumbPath } from "@/lib/paths"
import { ALLOWED_EXT, MAX_CLIPS, MAX_FILE_BYTES } from "@/lib/tiktok-specs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Fallback ekstensi bila nama file tanpa ekstensi — andalkan MIME browser.
const EXT_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-matroska": "mkv",
  "video/x-matroska-3d": "mkv",
  "video/x-msvideo": "avi",
  "video/avi": "avi",
  "video/3gpp": "3gp",
  "video/3gpp2": "3gp",
  "video/x-m4v": "m4v",
  "video/mp4v-es": "m4v",
}

function resolveExt(originalName: string, mime: string): string | null {
  const dot = originalName.lastIndexOf(".")
  let ext = dot >= 0 ? originalName.slice(dot + 1).toLowerCase() : ""
  if (!ext && mime) ext = EXT_BY_MIME[mime.toLowerCase()] ?? ""
  return ext && ALLOWED_EXT.includes(ext) ? ext : null
}

// Cek magic bytes — tolak file yang hanya menyamar sebagai video
// (ekstensi/MIME bisa dipalsukan; tanda tangan biner tidak).
async function hasVideoSignature(filePath: string): Promise<boolean> {
  const fh = await open(filePath, "r")
  try {
    const buf = Buffer.alloc(12)
    await fh.read(buf, 0, 12, 0)
    // MP4/MOV/M4V/3GP: "ftyp" di offset 4
    if (buf.subarray(4, 8).toString("latin1") === "ftyp") return true
    // WebM/MKV: EBML magic 1A 45 DF A3
    if (buf.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return true
    // AVI: "RIFF" .... "AVI "
    if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "AVI ")
      return true
    return false
  } finally {
    await fh.close()
  }
}

export async function POST(req: Request) {
  let filename: string | null = null
  try {
    const form = await req.formData()
    const file = form.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "File tidak ditemukan dalam permintaan." },
        { status: 400 }
      )
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "File kosong (0 byte)." }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `Ukuran melebihi ${MAX_FILE_BYTES / 1024 / 1024} MB.` },
        { status: 413 }
      )
    }

    const ext = resolveExt(file.name, file.type)
    if (!ext) {
      return NextResponse.json(
        { error: `Format tidak didukung. Pakai: ${ALLOWED_EXT.join(", ")}.` },
        { status: 415 }
      )
    }

    // Batas jumlah klip di studio (pool tunggal)
    const count = await db.clip.count()
    if (count >= MAX_CLIPS) {
      return NextResponse.json(
        {
          error: `Maksimal ${MAX_CLIPS} klip di studio. Hapus klip lama dulu untuk menambah.`,
        },
        { status: 400 }
      )
    }

    const id = randomUUID()
    filename = `${id}.${ext}`
    await ensureDirs()

    const dest = clipPath(filename)

    // Streaming file ke disk — tidak memuat seluruh body ke memori
    // (file bisa hingga 500 MB). Tipe DOM ReadableStream di-cast ke
    // tipe stream/web milik Node agar kompatibel dengan Readable.fromWeb().
    const nodeStream = Readable.fromWeb(
      file.stream() as unknown as NodeWebReadableStream<Uint8Array>
    )
    const writeStream = createWriteStream(dest, { flags: "w" })
    await pipeline(nodeStream, writeStream)

    // Tolak file palsu (bukan container video sungguhan)
    if (!(await hasVideoSignature(dest))) {
      await rm(dest, { force: true }).catch(() => undefined)
      return NextResponse.json(
        { error: "Isi file bukan video yang valid (signature tidak dikenali)." },
        { status: 415 }
      )
    }

    // Baca metadata teknis via ffprobe
    let probe
    try {
      probe = await probeVideo(dest)
    } catch {
      await rm(dest, { force: true }).catch(() => undefined)
      return NextResponse.json(
        { error: "File tidak berisi stream video yang valid." },
        { status: 400 }
      )
    }
    if (!probe.width || !probe.height || probe.duration <= 0) {
      await rm(dest, { force: true }).catch(() => undefined)
      return NextResponse.json(
        { error: "Metadata video tidak terbaca (korup atau tidak standar)." },
        { status: 400 }
      )
    }

    // Thumbnail (gagal bukan fatal — route /thumb akan regenerasi bila hilang)
    try {
      await makeThumbnail(dest, thumbPath(id), probe.duration)
    } catch {
      // abaikan
    }

    const clip = await db.clip.create({
      data: {
        id,
        filename,
        originalName: file.name || `clip-${id}.${ext}`,
        duration: probe.duration,
        width: probe.width,
        height: probe.height,
        fps: probe.fps,
        size: file.size,
        codec: probe.codec,
        hasAudio: probe.hasAudio,
      },
    })

    return NextResponse.json({ clip: toClipDTO(clip) })
  } catch (err) {
    // Bersihkan file setengah-tulis bila pipeline error
    if (filename) await rm(clipPath(filename), { force: true }).catch(() => undefined)
    const message = err instanceof Error ? err.message : "Gagal mengunggah file."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
