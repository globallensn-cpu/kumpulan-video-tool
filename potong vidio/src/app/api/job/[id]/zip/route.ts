import { spawn } from "child_process"
import { createReadStream } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"

import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/db"
import { ensureRecovered } from "@/lib/splitter"
import { baseName, jobDir, segmentLabel } from "@/lib/video-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function runZip(args: string[]): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("zip", args, { stdio: ["ignore", "ignore", "pipe"] })
    let stderr = ""
    proc.stderr.on("data", (c: Buffer) => {
      stderr = (stderr + c.toString()).slice(-2000)
    })
    proc.on("error", (err) => resolve({ code: -1, stderr: err.message }))
    proc.on("close", (code) => resolve({ code, stderr }))
  })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureRecovered()
  const { id } = await params
  const job = await db.job.findUnique({
    where: { id },
    include: { video: true, segments: { orderBy: { index: "asc" } } },
  })
  if (!job) {
    return NextResponse.json({ ok: false, error: "Pekerjaan tidak ditemukan." }, { status: 404 })
  }
  if (job.status !== "done" || job.segments.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Pekerjaan belum selesai atau gagal." },
      { status: 400 }
    )
  }

  const dir = jobDir(job.videoId, job.id)
  const ext = job.audioOnly ? "mp3" : "mp4"
  const zipPath = path.join(dir, `semua_bagian_${job.segmentDuration}s.${job.audioOnly ? "mp3" : "mp4"}.zip`)
  const videoName = job.video.originalName

  const st = await fs.stat(zipPath).catch(() => null)
  if (!st) {
    // buat symlink dengan nama ramah agar isi ZIP mudah dibaca
    const tmpDir = path.join(dir, "zipnames")
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    await fs.mkdir(tmpDir, { recursive: true })
    const friendlyFiles: string[] = []
    try {
      for (const s of job.segments) {
        const label = segmentLabel(videoName, s.index, ext)
        const link = path.join(tmpDir, label)
        await fs.symlink(path.join(dir, s.file), link)
        friendlyFiles.push(link)
      }
      const res = await runZip(["-j", "-q", zipPath, ...friendlyFiles])
      if (res.code !== 0) {
        return NextResponse.json(
          { ok: false, error: `Gagal membuat ZIP. ${res.stderr}` },
          { status: 500 }
        )
      }
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  }

  const zstat = await fs.stat(zipPath).catch(() => null)
  if (!zstat) {
    return NextResponse.json({ ok: false, error: "ZIP tidak dapat dibuat." }, { status: 500 })
  }

  const suffix = job.audioOnly ? `audio_mp3_${job.segmentDuration}detik` : `potongan_${job.segmentDuration}detik`
  const name = `${baseName(videoName)}_${suffix}.zip`
  const stream = createReadStream(zipPath)

  return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(zstat.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  })
}
