// Bersihkan semua data uji (file + baris DB) untuk menyiapkan server
import { PrismaClient } from "@prisma/client"
import { rm } from "node:fs/promises"

const db = new PrismaClient()

const jobs = await db.job.count()
const segs = await db.segment.count()
const vids = await db.video.count()
console.log(`Sebelum: ${vids} video, ${jobs} job, ${segs} segmen`)

await db.segment.deleteMany()
await db.job.deleteMany()
await db.video.deleteMany()
await rm("/home/z/my-project/video-data", { recursive: true, force: true })

console.log(`Sesudah: ${await db.video.count()} video, ${await db.job.count()} job, ${await db.segment.count()} segmen`)
console.log("Folder video-data dihapus")
await db.$disconnect()
