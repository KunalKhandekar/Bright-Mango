import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { reportProgress, reportProgressBeacon } from '@/api/progress'
import { keys } from '@/lib/query-client'
import { enqueue, flush, startAutoFlush } from '@/features/learn/progressQueue'
import { applyOptimisticProgress } from '@/features/learn/optimisticProgress'
import type { CourseProgress } from '@/types/models'

const REPORT_INTERVAL_MS = 15_000 // server rate limit is 5/10s per lesson; stay well under
// A playback timeupdate tick advances the position by ~0.25s (up to ~1s in throttled
// background tabs). Anything larger is a seek/jump and must not count as watched time.
const MAX_PLAYBACK_TICK_S = 3

/**
 * Event handlers wired onto <MediaPlayer> (via VideoPlayer) using Vidstack's React
 * event-callback props.
 */
export interface ProgressHandlers {
  onTimeUpdate: (detail: { currentTime: number }) => void
  onPlay: () => void
  onPause: () => void
  onSeeking: (detail: number) => void
  onEnded: () => void
}

/**
 * Reports the learner's playback progress for the active lesson as two values:
 *
 * - the LIVE position — drives the displayed lesson % (tracks the scrub bar, can rewind)
 *   and the resume bookmark;
 * - accumulated WATCHED seconds — real playback time summed from small timeupdate deltas.
 *   Seeks contribute nothing, so bumping the bar can never inflate the course % or complete
 *   a lesson. Seeded from the server's stored high-water so resumed sessions keep counting
 *   from where they left off; the server takes the max, so replays are always safe.
 *
 * Flushes on a 15s heartbeat (while playing), on pause, on ended, and on lesson
 * change/unmount (a normal ack'd request whose success invalidates the course-progress and
 * recently-watched queries — this is what keeps the dashboard fresh after navigating back).
 * On page hide/close it falls back to a keepalive beacon. Seeking only updates local state.
 *
 * Returns handlers the caller spreads onto <VideoPlayer/>. Disabled (mentors, guests,
 * non-enrolled preview viewers) → all handlers no-op so nothing is reported.
 */
export function useProgressReporter(
  lessonId: string | null,
  courseId: string,
  enabled: boolean,
): ProgressHandlers {
  const queryClient = useQueryClient()

  const positionRef = useRef(0) // latest playback position
  const lastTickRef = useRef(0) // previous timeupdate position (continuity anchor)
  const watchedRef = useRef(0) // accumulated actual watch time (seconds)
  const seededRef = useRef(false) // watchedRef initialized from the server's high-water?
  const lastSentRef = useRef<{ pos: number; watched: number } | null>(null) // avoid no-op sends
  const pausedRef = useRef(true) // heartbeat only sends while playing

  // Start this session's watched counter from the server's stored high-water, so a resumed
  // lesson keeps accumulating instead of restarting at 0 (the server takes the max, so an
  // unseeded send is safe — just a no-op for the course bar).
  const seedWatched = useCallback(() => {
    if (seededRef.current || !lessonId) return
    const cached = queryClient.getQueryData<CourseProgress>(keys.courseProgress(courseId))
    if (!cached) return
    seededRef.current = true
    const lesson = cached.lessons.find((l) => l.lessonId === lessonId)
    if (lesson) watchedRef.current = Math.max(watchedRef.current, lesson.watchedSeconds)
  }, [queryClient, courseId, lessonId])

  // The single choke point to the API. A failure spills to the durable queue so the report
  // survives a reload/offline period.
  const send = useCallback(
    (useBeacon: boolean) => {
      if (!enabled || !lessonId) return
      seedWatched()
      const pos = Math.floor(positionRef.current)
      const watched = Math.floor(watchedRef.current)
      if (lastSentRef.current?.pos === pos && lastSentRef.current?.watched === watched) return
      lastSentRef.current = { pos, watched }

      // Move the local progress bar immediately; the server refetch reconciles it.
      applyOptimisticProgress(queryClient, courseId, lessonId, pos, watched)

      if (useBeacon) {
        // Persist before firing: a keepalive fetch has no observable completion, so the
        // durable entry (cleared by the next successful ack) is what guarantees delivery.
        enqueue(lessonId, courseId, pos, watched)
        reportProgressBeacon(lessonId, pos, watched)
        return
      }

      void reportProgress(lessonId, pos, watched)
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: keys.courseProgress(courseId) })
          void queryClient.invalidateQueries({ queryKey: keys.recentProgress })
          // Drain anything a prior beacon/failure left queued (beacons have no ack).
          void flush()
        })
        .catch(() => {
          enqueue(lessonId, courseId, pos, watched)
        })
    },
    [enabled, lessonId, courseId, queryClient, seedWatched],
  )

  const onTimeUpdate = useCallback((detail: { currentTime: number }) => {
    const t = detail?.currentTime
    if (!Number.isFinite(t)) return
    // Only a small forward tick while playing counts as watched time — seeks (guarded both
    // by onSeeking re-anchoring and by the tick-size cap) add nothing.
    const delta = t - lastTickRef.current
    if (!pausedRef.current && delta > 0 && delta <= MAX_PLAYBACK_TICK_S) {
      watchedRef.current += delta
    }
    lastTickRef.current = t
    positionRef.current = t
  }, [])

  const onPlay = useCallback(() => {
    pausedRef.current = false
  }, [])

  const onPause = useCallback(() => {
    pausedRef.current = true
    send(false)
  }, [send])

  // Scrubbing moves the live position (and the continuity anchor) locally; the next
  // heartbeat/pause/unmount flush persists it. No network call per bump — rapid scrubbing
  // would trip the server rate limit, and a seek never changes watched time anyway.
  const onSeeking = useCallback(
    (detail: number) => {
      if (!Number.isFinite(detail)) return
      positionRef.current = detail
      lastTickRef.current = detail
      if (enabled && lessonId) {
        seedWatched()
        applyOptimisticProgress(
          queryClient,
          courseId,
          lessonId,
          Math.floor(detail),
          Math.floor(watchedRef.current),
        )
      }
    },
    [enabled, lessonId, courseId, queryClient, seedWatched],
  )

  const onEnded = useCallback(() => {
    pausedRef.current = true
    send(false)
  }, [send])

  // Reset for the new lesson, run the heartbeat while playing, and flush reliably on
  // tab-hide / unload (beacon) and on lesson-change/unmount (ack'd request → dashboard
  // queries invalidate). Keyed on lesson/enable only — no player instance needed, so no
  // teardown churn when the player re-renders.
  useEffect(() => {
    if (!enabled || !lessonId) return

    positionRef.current = 0
    lastTickRef.current = 0
    watchedRef.current = 0
    seededRef.current = false
    lastSentRef.current = null
    pausedRef.current = true
    seedWatched()

    const interval = window.setInterval(() => {
      if (!pausedRef.current) send(false)
    }, REPORT_INTERVAL_MS)

    const onHide = () => {
      if (document.visibilityState === 'hidden') send(true)
    }
    const onPageHide = () => send(true)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
      // Final flush for the lesson we're leaving (this cleanup closes over the old send).
      // A normal request, not a beacon: the fetch outlives the component, and its ack
      // invalidates the dashboard's course-progress + continue-watching queries.
      send(false)
    }
  }, [enabled, lessonId, send, seedWatched])

  // Drain progress left un-acked by a prior crash / offline period, and on reconnect.
  useEffect(() => {
    if (!enabled) return
    return startAutoFlush()
  }, [enabled])

  return { onTimeUpdate, onPlay, onPause, onSeeking, onEnded }
}
