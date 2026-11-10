// Skrip uji Fase 1: verifikasi baris DB + buat job yatim palsu
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

const [vc, jc] = await Promise.all([db.video.count(), db.job.count()])
console.log(`DB — video: ${vc}, job: ${jc}`)

const sc = await db.segment.count()
console.log(`DB — segment: ${sc}`)

const v = await db.video.findFirst({ include: { jobs: { include: { segments: true } } } })
if (v) {
  console.log(`Video: ${v.originalName} (${v.duration}s, hasAudio=${v.hasAudio}) — ${v.jobs.length} job`)
  for (const j of v.jobs) {
    console.log(`  job ${j.id.slice(0, 8)}… status=${j.status} mode=${j.mode} segDur=${j.segmentDuration} segmen=${j.segments.length}`)
  }
}

// buat job yatim palsu (status processing) untuk menguji pemulihan
if (v) {
  const orphan = await db.job.create({
    data: {
      status: "processing",
      mode: "fast",
      segmentDuration: 10,
      totalDuration: v.duration,
      totalSegments: 3,
      videoId: v.id,
    },
  })
  console.log(`Job yatim dibuat: ${orphan.id} (status=${orphan.status})`)
  console.log(`ORPHAN_ID=${orphan.id}`)
}

await db.$disconnect()
