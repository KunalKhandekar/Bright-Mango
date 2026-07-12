import { api, unwrap } from '@/lib/axios'
import type { Lesson } from '@/types/models'

/** Curriculum for a course (safe fields; public for published, owner for drafts). */
export function listLessonsByCourse(courseId: string) {
  return unwrap<{ lessons: Lesson[] }>(api.get(`/courses/${courseId}/lessons`))
}

export function getPlayback(lessonId: string) {
  return unwrap<{ playbackId: string; token: string }>(api.get(`/lessons/${lessonId}/playback`))
}

// ── Mentor ──────────────────────────────────────────────────────────────────

export interface LessonInput {
  title: string
  description?: string
  isPreview?: boolean
}

export function createLesson(chapterId: string, input: LessonInput) {
  return unwrap<{ lesson: Lesson }>(api.post(`/chapters/${chapterId}/lessons`, input))
}

export function updateLesson(
  id: string,
  input: Partial<LessonInput & { thumbnailUrl: string }>,
) {
  return unwrap<{ lesson: Lesson }>(api.patch(`/lessons/${id}`, input))
}

export function deleteLesson(id: string) {
  return unwrap<Record<string, never>>(api.delete(`/lessons/${id}`))
}

export function reorderLessons(chapterId: string, orderedIds: string[]) {
  return unwrap<Record<string, never>>(
    api.patch(`/chapters/${chapterId}/lessons/reorder`, { orderedIds }),
  )
}

export function createVideoUploadUrl(lessonId: string) {
  return unwrap<{ uploadUrl: string; uid: string }>(
    api.post(`/lessons/${lessonId}/video/upload-url`),
  )
}

/** Tell the server the direct upload never completed so the lesson isn't stuck "processing". */
export function reportVideoUploadFailed(lessonId: string, uid: string) {
  return unwrap<Record<string, never>>(
    api.post(`/lessons/${lessonId}/video/upload-failed`, { uid }),
  )
}
