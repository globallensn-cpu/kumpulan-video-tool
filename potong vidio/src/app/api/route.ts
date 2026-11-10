import { NextResponse } from "next/server"

import { MAX_AGE_MS } from "@/lib/video-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Health check root: status layanan + info dasar. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "potongvideo",
    version: "1.0.0",
    maxAgeMs: MAX_AGE_MS,
    endpoints: {
      upload: "/api/upload",
      split: "/api/split",
      job: "/api/job/:id",
      video: "/api/video/:id",
    },
  })
}
