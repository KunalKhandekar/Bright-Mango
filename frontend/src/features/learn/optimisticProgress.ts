import type { QueryClient } from '@tanstack/react-query'
import { keys } from '@/lib/query-client'
import type { CourseProgress } from '@/types/models'

// Mirror of backend business rules in `backend/src/modules/progress/progress.service.ts`.
// The server remains the source of truth (a refetch reconciles every value); this only
// moves the bar instantly so playback feels responsive. Keep in lockstep with
// COMPLETE_THRESHOLD and the position-based / high-water formulas there.
const COMPLETE_THRESHOLD = 0.9

/**
 * Optimistically set the active lesson's LIVE position in the cached course progress, then
 * recompute the monotonic (high-water) overall percentage exactly as the backend does. No-op
 * if the query isn't cached yet or the lesson has no known duration (we never fabricate data).
 */
export function applyOptimisticProgress(
  queryClient: QueryClient,
  courseId: string,
  lessonId: string,
  positionSeconds: number,
): void {
  queryClient.setQueryData<CourseProgress>(keys.courseProgress(courseId), (prev) => {
    if (!prev) return prev

    const lessons = prev.lessons.map((l) => {
      if (l.lessonId !== lessonId) return l
      const duration = l.durationSeconds || 0
      if (duration <= 0) return l
      const position = Math.min(duration, Math.max(0, positionSeconds))
      return {
        ...l,
        // Displayed lesson % is live (tracks the scrub bar).
        completionPercentage: Math.min(100, Math.round((position / duration) * 100)),
        lastPositionSeconds: position,
        // watchedSeconds is the monotonic high-water mark; completion is sticky.
        watchedSeconds: Math.min(duration, Math.max(l.watchedSeconds, position)),
        completed: l.completed || position / duration >= COMPLETE_THRESHOLD,
      }
    })

    // Course % is high-water: sum(completed ? duration : watchedSeconds) / sum(durations).
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
