import { create } from 'zustand'

interface PlayerState {
  activeLessonId: string | null
  autoplayNext: boolean
  setActiveLessonId: (id: string | null) => void
  setAutoplayNext: (on: boolean) => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  activeLessonId: null,
  autoplayNext: true,
  setActiveLessonId: (activeLessonId) => set({ activeLessonId }),
  setAutoplayNext: (autoplayNext) => set({ autoplayNext }),
}))
