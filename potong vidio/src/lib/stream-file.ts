import { createReadStream } from "node:fs"
import fs from "node:fs/promises"
import { Readable } from "node:stream"

import { NextRequest, NextResponse } from "next/server"

/**
 * Kirim file media sebagai response dengan dukungan HTTP Range
 * agar bisa di-seek pada elemen <video> / <audio>.
 */
export async function streamVideoFile(
  req: NextRequest,
  filePath: string,
  opts: { filename: string; download?: boolean; contentType?: string }
): Promise<NextResponse> {
  const stat = await fs.stat(filePath).catch(() => null)
  if (!stat || !stat.isFile()) {
    return NextResponse.json({ ok: false, error: "File tidak ditemukan." }, { status: 404 })
  }

  const total = stat.size
  const encodedName = encodeURIComponent(opts.filename)
  const disposition = opts.download ? "attachment" : "inline"
  const headers: Record<string, string> = {
    "Content-Type": opts.contentType ?? "video/mp4",
    "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedName}`,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  }

  const range = req.headers.get("range")
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range)
    if (m) {
      const start = m[1] ? Number(m[1]) : 0
      const end = m[2] ? Math.min(Number(m[2]), total - 1) : total - 1
      if (Number.isFinite(start) && start <= end && start < total) {
        const stream = createReadStream(filePath, { start, end })
        return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>, {
          status: 206,
          headers: {
            ...headers,
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Content-Length": String(end - start + 1),
          },
        })
      }
    }
  }

  const stream = createReadStream(filePath)
  return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>, {
    status: 200,
    headers: { ...headers, "Content-Length": String(total) },
  })
}
