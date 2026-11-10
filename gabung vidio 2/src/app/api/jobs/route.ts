// POST /api/jobs — jalankan pipeline gabung + encode + AI metadata

import { NextResponse } from "next/server"
import { access, rm } from "fs/promises"
import { db } from "@/lib/db"
import { clipPath, ensureDirs, JOBS_DIR } from "@/lib/paths"
import { cancelJob, clearMemory, isRunning, startJob, type MergeInput } from "@/lib/pipeline"
import { DEFAULT_SETTINGS, MAX_CLIPS } from "@/lib/tiktok-specs"
import type { AspectMode, JobSettings, QualityMode } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseSettings(raw: unknown): JobSettings {
  const s = (raw ?? {}) as Partial<JobSettings>
  const aspect: AspectMode = s.aspect === "crop" || s.aspect === "fit" ? s.aspect : "blur"
  const fps = Number(s.fps) === 60 ? 60 : 30
  const quality: QualityMode =
    s.quality === "balanced" || s.quality === "ultra" ? s.quality : DEFAULT_SETTINGS.quality
  return { aspect, fps, quality }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { clipIds?: unknown; settings?: unknown }
    const clipIds = Array.isArray(body.clipIds) ? body.clipIds.map((x) => String(x)) : []

    if (clipIds.length === 0) {
      return NextResponse.json({ error: "Pilih minimal 1 klip." }, { status: 400 })
    }
    if (clipIds.length > MAX_CLIPS) {
      return NextResponse.json({ error: `Maksimal ${MAX_CLIPS} klip per video.` }, { status: 400 })
    }
    if (isRunning()) {
      return NextResponse.json(
        { error: "Pipeline lain masih berjalan — tunggu selesai atau batalkan dulu." },
        { status: 409 }
      )
    }

    const clips = await db.clip.findMany({ where: { id: { in: clipIds } } })
    if (clips.length !== new Set(clipIds).size) {
      return NextResponse.json({ error: "Ada klip yang tidak ditemukan." }, { status: 400 })
    }
    const byId = new Map(clips.map((c) => [c.id, c]))
    const ordered = clipIds.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c))

    // Pre-check: pastikan semua file klip masih ada di storage sebelum spawn
    // ffmpeg — pesan error yang jelas, bukan kegagalan encode teknis.
    for (const c of ordered) {
      try {
        await access(clipPath(c.filename))
      } catch {
        return NextResponse.json(
          {
            error: `File klip "${c.originalName}" sudah tidak ada di storage. Hapus klip tersebut lalu unggah ulang.`,
          },
          { status: 400 }
        )
      }
    }

    // Slot tunggal: bersihkan job lama (file + record + memori)
    for (const j of await db.job.findMany({ select: { id: true } })) {
      cancelJob(j.id)
    }
    clearMemory()
    await rm(JOBS_DIR, { recursive: true, force: true }).catch(() => undefined)
    await ensureDirs()
    await db.job.deleteMany()

    const settings = parseSettings(body.settings)
    const job = await db.job.create({
      data: {
        settingsJson: JSON.stringify(settings),
        clipIdsJson: JSON.stringify(clipIds),
        clipCount: ordered.length,
        status: "processing",
        stage: "prepare",
        progress: 1,
      },
    })

    const inputs: MergeInput[] = ordered.map((c) => ({
      path: clipPath(c.filename),
      duration: c.duration,
      hasAudio: c.hasAudio,
      name: c.originalName,
    }))

    startJob(job.id, inputs, settings)

    return NextResponse.json({ jobId: job.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memulai pipeline."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
