import { api, unwrap } from '@/lib/axios'
import type { LessonResource } from '@/types/models'

export function listLessonResources(lessonId: string) {
  return unwrap<{ resources: LessonResource[] }>(api.get(`/lessons/${lessonId}/resources`))
}

export function getResourceDownloadUrl(id: string) {
  return unwrap<{ url: string; fileName: string }>(api.get(`/resources/${id}/download`))
}

// ── Mentor ──────────────────────────────────────────────────────────────────

export function createResourceUploadUrl(
  lessonId: string,
  input: { fileName: string; contentType: string },
) {
  return unwrap<{ uploadUrl: string; fileKey: string }>(
    api.post(`/lessons/${lessonId}/resources/upload-url`, input),
  )
}

export function registerResource(
  lessonId: string,
  input: {
    title: string
    fileKey: string
    fileName: string
    fileSize?: number
    contentType?: string
  },
) {
  return unwrap<{ resource: LessonResource }>(api.post(`/lessons/${lessonId}/resources`, input))
}

export function deleteResource(id: string) {
  return unwrap<Record<string, never>>(api.delete(`/resources/${id}`))
}
