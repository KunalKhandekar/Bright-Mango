import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { reportProgress, reportProgressBeacon } from '@/api/progress'
import { keys } from '@/lib/query-client'
import { enqueue, flush, startAutoFlush } from '@/features/learn/progressQueue'
import { applyOptimisticProgress } from '@/features/learn/optimisticProgress'

const REPORT_INTERVAL_MS = 15_000 // server rate limit is 5/10s per lesson; stay well under

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
 * Reports the learner's LIVE playback position for the active lesson. The backend derives the
 * displayed lesson % straight from that position (so it tracks the scrub bar and can move
 * backwards on rewind), keeps a monotonic high-water mark for course progress, and sticks
 * completion once ≥90% is reached.
 *
 * The current position is flushed on a 15s heartbeat (while playing), on pause, on seek, on
 * ended, on lesson change/unmount, and on page hide (via a keepalive beacon so the final
 * position survives a tab/window close).
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
  const lastSentPosRef = useRef(-1) // avoid no-op sends
  const pausedRef = useRef(true) // heartbeat only sends while playing

  // The single choke point to the API. A failure spills to the durable queue so the position
  // survives a reload/offline period.
  const send = useCallback(
    (useBeacon: boolean) => {
      if (!enabled || !lessonId) return
      const pos = Math.floor(positionRef.current)
      if (pos === lastSentPosRef.current) return
      lastSentPosRef.current = pos

      // Move the local progress bar immediately; the server refetch reconciles it.
      applyOptimisticProgress(queryClient, courseId, lessonId, pos)

      if (useBeacon) {
        // Persist before firing: a keepalive fetch has no observable completion, so the
        // durable entry (cleared by the next successful ack) is what guarantees delivery.
        enqueue(lessonId, courseId, pos)
        reportProgressBeacon(lessonId, pos)
        return
      }

      void reportProgress(lessonId, pos)
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: keys.courseProgress(courseId) })
          // Drain anything a prior beacon/failure left queued (beacons have no ack).
          void flush()
        })
        .catch(() => {
          enqueue(lessonId, courseId, pos)
        })
    },
    [enabled, lessonId, courseId, queryClient],
  )

  const onTimeUpdate = useCallback((detail: { currentTime: number }) => {
    const t = detail?.currentTime
    if (Number.isFinite(t)) positionRef.current = t
  }, [])

  const onPlay = useCallback(() => {
    pausedRef.current = false
  }, [])

  const onPause = useCallback(() => {
    pausedRef.current = true
    send(false)
  }, [send])

  // Scrubbing updates the live position immediately so the % tracks the bar.
  const onSeeking = useCallback(
    (detail: number) => {
      if (Number.isFinite(detail)) positionRef.current = detail
      send(false)
    },
    [send],
  )

  const onEnded = useCallback(() => {
    pausedRef.current = true
    send(false)
  }, [send])

  // Reset for the new lesson, run the heartbeat while playing, and flush reliably on
  // tab-hide / unload / lesson-change (beacon). Keyed on lesson/enable only — no player
  // instance needed, so no teardown churn when the player re-renders.
  useEffect(() => {
    if (!enabled || !lessonId) return

    positionRef.current = 0
    lastSentPosRef.current = -1
    pausedRef.current = true

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
      send(true)
    }
  }, [enabled, lessonId, send])

  // Drain progress left un-acked by a prior crash / offline period, and on reconnect.
  useEffect(() => {
    if (!enabled) return
    return startAutoFlush()
  }, [enabled])

  return { onTimeUpdate, onPlay, onPause, onSeeking, onEnded }
}
