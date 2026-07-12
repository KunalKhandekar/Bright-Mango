import { api, unwrap } from '@/lib/axios'
import { env } from '@/lib/env'
import type { CourseProgress, LessonProgress, RecentlyWatchedItem } from '@/types/models'

/**
 * Report playback progress. `positionSeconds` is the live position (drives the lesson % and
 * the resume bookmark); `watchedSeconds` is the accumulated actual watch time (drives the
 * monotonic course % and completion — seeks contribute nothing to it).
 */
export function reportProgress(lessonId: string, positionSeconds: number, watchedSeconds: number) {
  return unwrap<{ progress: LessonProgress }>(
    api.put(`/progress/lessons/${lessonId}`, { positionSeconds, watchedSeconds }),
  )
}

/**
 * Fire-and-forget progress flush that survives page unload. `keepalive` lets the
 * request outlive the document; cookie auth rides along via `credentials: 'include'`.
 */
export function reportProgressBeacon(
  lessonId: string,
  positionSeconds: number,
  watchedSeconds: number,
): void {
  try {
    void fetch(`${env.apiUrl}/progress/lessons/${lessonId}`, {
      method: 'PUT',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionSeconds, watchedSeconds }),
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
