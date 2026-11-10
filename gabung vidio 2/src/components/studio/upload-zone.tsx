"use client"

import * as React from "react"
import { Loader2, UploadCloud, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useStudio } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { ClipDTO } from "@/lib/types"
import { MAX_CLIPS, MAX_FILE_BYTES } from "@/lib/tiktok-specs"

class UploadCanceled extends Error {
  constructor() {
    super("__canceled")
  }
}

const ACCEPT =
  "video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-msvideo,video/3gpp,.mp4,.mov,.webm,.mkv,.avi,.m4v,.3gp"

export function UploadZone({ disabled }: { disabled: boolean }) {
  const addClip = useStudio((s) => s.addClip)
  const { toast } = useToast()
  const [dragging, setDragging] = React.useState(false)
  const [progress, setProgress] = React.useState<{
    name: string
    pct: number
    index: number
    total: number
  } | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const xhrRef = React.useRef<XMLHttpRequest | null>(null)

  const cancelUpload = () => {
    xhrRef.current?.abort()
  }

  const uploadOne = (file: File) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhrRef.current = xhr
      const fd = new FormData()
      fd.append("file", file)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress((p) => (p ? { ...p, pct: Math.round((e.loaded / e.total) * 100) } : p))
        }
      }
      // Batas 15 menit per file — jangan biarkan request menggantung selamanya
      xhr.timeout = 15 * 60 * 1000
      xhr.ontimeout = () => reject(new Error("Waktu upload habis (15 menit). Coba lagi."))
      xhr.onabort = () => reject(new UploadCanceled())
      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText) as { clip: ClipDTO }
            addClip(data.clip)
            resolve()
          } catch {
            reject(new Error("Respons server tidak valid"))
          }
        } else {
          try {
            const data = JSON.parse(xhr.responseText) as { error?: string }
            reject(new Error(data.error ?? "Upload gagal"))
          } catch {
            reject(new Error(`Upload gagal (${xhr.status})`))
          }
        }
      }
      xhr.onerror = () => reject(new Error("Koneksi terputus saat upload"))
      xhr.open("POST", "/api/upload")
      xhr.send(fd)
    })

  const handleFiles = async (files: FileList | File[]) => {
    if (disabled) {
      toast({ title: "Tunggu proses selesai", description: "Upload dinonaktifkan selama pipeline berjalan." })
      return
    }
    const list = Array.from(files)
    if (list.length === 0) return
    const total = list.length
    for (let i = 0; i < list.length; i++) {
      const file = list[i]
      // Batas jumlah klip dicek juga di client — feedback instan tanpa upload sia-sia
      if (useStudio.getState().clips.length >= MAX_CLIPS) {
        toast({
          title: `Batas ${MAX_CLIPS} klip tercapai`,
          description: `${list.length - i} file berikutnya dilewati. Hapus klip lama dulu.`,
          variant: "destructive",
        })
        break
      }
      if (file.size > MAX_FILE_BYTES) {
        toast({
          title: "File terlalu besar",
          description: `${file.name} melebihi 500 MB.`,
          variant: "destructive",
        })
        continue
      }
      try {
        setProgress({ name: file.name, pct: 0, index: i + 1, total })
        await uploadOne(file)
        toast({ title: "Klip terunggah ✅", description: file.name })
      } catch (err) {
        if (err instanceof UploadCanceled) {
          toast({ title: "Upload dibatalkan", description: file.name })
          break
        }
        toast({
          title: "Upload gagal",
          description: err instanceof Error ? err.message : "Terjadi kesalahan.",
          variant: "destructive",
        })
      }
    }
    xhrRef.current = null
    setProgress(null)
  }

  const busy = Boolean(progress)

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Zona unggah video"
      onClick={() => {
        if (!disabled && !busy) inputRef.current?.click()
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          if (!disabled && !busy) inputRef.current?.click()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (!disabled && !busy) void handleFiles(e.dataTransfer.files)
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE2C55]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]",
        dragging
          ? "scale-[1.01] border-[#FE2C55] bg-[#FE2C55]/5"
          : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70",
        (disabled || busy) && "pointer-events-none cursor-not-allowed opacity-60"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) void handleFiles(e.target.files)
          e.target.value = ""
        }}
      />
      {progress ? (
        <div className="w-full max-w-sm space-y-3">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#FE2C55]" />
          <div>
            <p className="truncate text-sm font-medium">{progress.name}</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#FE2C55] to-[#FF7A59] transition-all"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {progress.total > 1 && (
                <span className="mr-1 font-mono text-zinc-400">
                  [{progress.index}/{progress.total}]
                </span>
              )}
              Mengunggah &amp; membaca metadata · {progress.pct}%
            </p>
            <button
              type="button"
              onClick={cancelUpload}
              className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-700 px-3 text-[11px] font-medium text-zinc-400 transition-colors hover:border-red-500/40 hover:text-red-300"
            >
              <X className="h-3 w-3" /> Batalkan upload
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#FE2C55]/20 to-[#25F4EE]/10 ring-1 ring-inset ring-[#FE2C55]/30">
            <UploadCloud className="h-7 w-7 text-[#FF5C7A]" />
          </div>
          <div>
            <p className="text-sm font-semibold">Tarik &amp; lepas video di sini</p>
            <p className="mt-0.5 text-xs text-zinc-500">atau klik untuk memilih beberapa file sekaligus</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] text-zinc-500">
            {["MP4", "MOV", "WebM", "MKV", "AVI"].map((f) => (
              <span key={f} className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5">
                {f}
              </span>
            ))}
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5">maks 500 MB / file</span>
          </div>
        </>
      )}
    </div>
  )
}
