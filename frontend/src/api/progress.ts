import { api, unwrap } from '@/lib/axios'
import { env } from '@/lib/env'
import type { CourseProgress, LessonProgress, RecentlyWatchedItem } from '@/types/models'

/** Report newly-watched time (delta) plus the current resume position. */
export function reportProgress(lessonId: string, deltaSeconds: number, positionSeconds: number) {
  return unwrap<{ progress: LessonProgress }>(
    api.put(`/progress/lessons/${lessonId}`, { deltaSeconds, positionSeconds }),
  )
}

/**
 * Fire-and-forget progress flush that survives page unload. `keepalive` lets the
 * request outlive the document; cookie auth rides along via `credentials: 'include'`.
 */
export function reportProgressBeacon(
  lessonId: string,
  deltaSeconds: number,
  positionSeconds: number,
): void {
  try {
    void fetch(`${env.apiUrl}/progress/lessons/${lessonId}`, {
      method: 'PUT',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deltaSeconds, positionSeconds }),
    })
  } catch {
    // Best-effort: nothing more we can do during unload.
  }
}

export function getCourseProgress(courseId: string) {
  return unwrap<CourseProgress>(api.get(`/progress/courses/${courseId}`))
}

export function getRecentlyWatched() {
  return unwrap<{ lessons: RecentlyWatchedItem[] }>(api.get('/progress/recent'))
}
