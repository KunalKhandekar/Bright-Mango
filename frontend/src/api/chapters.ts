import { api, unwrap } from '@/lib/axios'
import type { Chapter } from '@/types/models'

export function listChapters(courseId: string) {
  return unwrap<{ chapters: Chapter[] }>(api.get(`/courses/${courseId}/chapters`))
}

export function createChapter(courseId: string, input: { title: string; description?: string }) {
  return unwrap<{ chapter: Chapter }>(api.post(`/courses/${courseId}/chapters`, input))
}

export function updateChapter(id: string, input: { title?: string; description?: string }) {
  return unwrap<{ chapter: Chapter }>(api.patch(`/chapters/${id}`, input))
}

export function deleteChapter(id: string) {
  return unwrap<Record<string, never>>(api.delete(`/chapters/${id}`))
}

export function reorderChapters(courseId: string, orderedIds: string[]) {
  return unwrap<Record<string, never>>(
    api.patch(`/courses/${courseId}/chapters/reorder`, { orderedIds }),
  )
}
