import type { QueryClient } from '@tanstack/react-query'
import { keys } from '@/lib/query-client'
import type { CourseProgress } from '@/types/models'

// Mirror of backend business rules in `backend/src/modules/progress/progress.service.ts`.
// The server remains the source of truth (a refetch reconciles every value); this only
// moves the bar instantly so playback feels responsive. Keep these in lockstep with
// COMPLETE_THRESHOLD and the duration-weighted percentage formula there.
const COMPLETE_THRESHOLD = 0.9

/**
 * Optimistically advance the active lesson's watch-time in the cached course progress, then
 * recompute the duration-weighted overall percentage exactly as the backend does. No-op if
 * the query isn't cached yet or the lesson has no known duration (we never fabricate data).
 */
export function applyOptimisticProgress(
  queryClient: QueryClient,
  courseId: string,
  lessonId: string,
  deltaSeconds: number,
  positionSeconds: number,
): void {
  queryClient.setQueryData<CourseProgress>(keys.courseProgress(courseId), (prev) => {
    if (!prev) return prev

    const lessons = prev.lessons.map((l) => {
      if (l.lessonId !== lessonId) return l
      const duration = l.durationSeconds || 0
      if (duration <= 0) return l
      const watchedSeconds = Math.min(duration, l.watchedSeconds + Math.max(0, deltaSeconds))
      const completed = l.completed || watchedSeconds / duration >= COMPLETE_THRESHOLD
      return {
        ...l,
        watchedSeconds,
        // completion is sticky and can only move up
        completed,
        completionPercentage: Math.min(100, Math.round((watchedSeconds / duration) * 100)),
        lastPositionSeconds: Math.max(l.lastPositionSeconds, Math.max(0, positionSeconds)),
      }
    })

    // Duration-weighted overall %: sum(watched, or full duration if completed) / sum(durations).
    let totalDuration = 0
    let watchedTotal = 0
    for (const l of lessons) {
      const duration = l.durationSeconds || 0
      if (duration <= 0) continue
      totalDuration += duration
      watchedTotal += l.completed ? duration : Math.min(l.watchedSeconds, duration)
    }

    return {
      ...prev,
      completedLessons: lessons.filter((l) => l.completed).length,
      percentage:
        totalDuration > 0 ? Math.min(100, Math.round((watchedTotal / totalDuration) * 100)) : 0,
      lessons,
    }
  })
}
