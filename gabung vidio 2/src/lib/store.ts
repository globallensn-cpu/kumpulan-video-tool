// ============================================================
// TokForge — State global client (Zustand)
// Clips & job di-fetch dari API; settings dipersist ke localStorage
// ============================================================

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ClipDTO, JobDTO, JobSettings } from "./types"
import { DEFAULT_SETTINGS } from "./tiktok-specs"

interface StudioState {
  clips: ClipDTO[]
  settings: JobSettings
  job: JobDTO | null
  setClips: (clips: ClipDTO[]) => void
  addClip: (clip: ClipDTO) => void
  removeClip: (id: string) => void
  setSettings: (patch: Partial<JobSettings>) => void
  setJob: (job: JobDTO | null) => void
}

export const useStudio = create<StudioState>()(
  persist(
    (set) => ({
      clips: [],
      settings: DEFAULT_SETTINGS,
      job: null,
      setClips: (clips) => set({ clips }),
      addClip: (clip) => set((s) => ({ clips: [...s.clips, clip] })),
      removeClip: (id) => set((s) => ({ clips: s.clips.filter((c) => c.id !== id) })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setJob: (job) => set({ job }),
    }),
    {
      name: "tokforge-settings",
      partialize: (s) => ({ settings: s.settings }),
    }
  )
)
