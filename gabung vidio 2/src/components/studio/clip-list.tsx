"use client"

import * as React from "react"
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { AlertTriangle, GripVertical, Loader2, Volume2, VolumeX, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useStudio } from "@/lib/store"
import { cn } from "@/lib/utils"
import { formatBytes, formatDuration } from "@/lib/format"
import type { ClipDTO } from "@/lib/types"

function ClipRow({ clip, order, disabled }: { clip: ClipDTO; order: number; disabled: boolean }) {
  const removeClip = useStudio((s) => s.removeClip)
  const { toast } = useToast()
  const [removing, setRemoving] = React.useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: clip.id,
    disabled: disabled || removing,
  })

  const isPortrait = clip.height >= clip.width
  const isTargetRatio = Math.abs(clip.width / clip.height - 9 / 16) < 0.02

  const remove = async () => {
    setRemoving(true)
    try {
      const r = await fetch(`/api/clips/${clip.id}`, { method: "DELETE" })
      if (!r.ok) throw new Error()
      removeClip(clip.id)
    } catch {
      toast({ title: "Gagal menghapus klip", variant: "destructive" })
      setRemoving(false)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5 transition-colors",
        isDragging ? "z-10 border-[#FE2C55]/60 bg-zinc-900 shadow-xl shadow-black/50" : "hover:border-zinc-700",
        removing && "opacity-50"
      )}
    >
      <button
        type="button"
        aria-label="Tarik untuk mengubah urutan"
        {...attributes}
        {...listeners}
        className={cn(
          "-m-2 touch-none rounded-md p-3.5 text-zinc-600 transition-colors hover:text-zinc-300",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE2C55]/70",
          disabled ? "cursor-not-allowed opacity-40" : "cursor-grab active:cursor-grabbing"
        )}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#FE2C55]/15 text-[11px] font-bold text-[#FF6B85]">
        {order}
      </span>

      <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-zinc-800">
        <img
          src={clip.thumbUrl}
          alt={`Thumbnail ${clip.originalName}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={clip.originalName}>
          {clip.originalName}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
          <span className={cn(!isPortrait && "font-medium text-amber-400")}>
            {clip.width}×{clip.height}
          </span>
          <span>·</span>
          <span>{Math.round(clip.fps)} fps</span>
          <span>·</span>
          <span>{formatBytes(clip.size)}</span>
          <span>·</span>
          <span className="uppercase">{clip.codec}</span>
          {clip.hasAudio ? (
            <Volume2 className="h-3 w-3 text-emerald-500/80" aria-label="punya audio" />
          ) : (
            <VolumeX className="h-3 w-3 text-zinc-600" aria-label="tanpa audio" />
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!isTargetRatio && (
          <span
            className="hidden items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 sm:inline-flex"
            title="Rasio bukan 9:16 — akan dikonversi otomatis sesuai mode pengaturan"
          >
            <AlertTriangle className="h-3 w-3" />
            {isPortrait ? "auto 9:16" : "landscape → 9:16"}
          </span>
        )}
        <span className="rounded-md bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-300">
          {formatDuration(clip.duration)}
        </span>
        <button
          type="button"
          onClick={remove}
          disabled={disabled || removing}
          aria-label={`Hapus ${clip.originalName}`}
          className="-m-2 rounded-md p-3.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

export function ClipList({ disabled }: { disabled: boolean }) {
  const clips = useStudio((s) => s.clips)
  const setClips = useStudio((s) => s.setClips)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = clips.findIndex((c) => c.id === active.id)
    const newIndex = clips.findIndex((c) => c.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    setClips(arrayMove(clips, oldIndex, newIndex))
  }

  if (clips.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/20 px-4 py-5 text-center text-xs text-zinc-600">
        Belum ada klip — unggah 2 atau lebih video untuk mulai menggabungkan.
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={clips.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {clips.map((clip, i) => (
            <li key={clip.id}>
              <ClipRow clip={clip} order={i + 1} disabled={disabled} />
            </li>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
