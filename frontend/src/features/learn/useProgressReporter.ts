import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { reportProgress, reportProgressBeacon } from '@/api/progress'
import { keys } from '@/lib/query-client'
import { enqueue, flush, startAutoFlush } from '@/features/learn/progressQueue'
import { applyOptimisticProgress } from '@/features/learn/optimisticProgress'

const REPORT_INTERVAL_MS = 15_000 // server rate limit is 5/10s per lesson; stay well under
// Base gap (at 1x) between two time-update ticks that still counts as continuous
// playback. Scaled by playback rate below so fast-but-continuous playback (2x, etc.)
// is still counted; only larger forward jumps (seeks) or rewinds are dropped.
const BASE_STEP_SECONDS = 2

/**
 * Event handlers wired onto <MediaPlayer> (via VideoPlayer). We use Vidstack's React
 * event-callback props — NOT the imperative `player.listen(...)`, which is scope-bound and
 * silently fails to deliver when called from a React effect.
 */
export interface ProgressHandlers {
  onTimeUpdate: (detail: { currentTime: number }) => void
  onPlay: () => void
  onPause: () => void
  onSeeking: (detail: number) => void
  onRateChange: (detail: number) => void
  onEnded: () => void
}

/**
 * Reports "true watch-time" for the active lesson: only seconds actually played are
 * counted (seeks/jumps are ignored), so progress can't be gamed by scrubbing to the end.
 *
 * Accumulation (accurate) is decoupled from network sends (throttled):
 * - Every `time-update` tick adds the elapsed play-time to an unsent accumulator.
 * - The accumulated delta + current position are flushed to the server on a 15s heartbeat,
 *   on pause, on seek, on ended, on lesson change/unmount, and on page hide (via a keepalive
 *   beacon so the final seconds survive a tab/window close).
 *
 * Returns handlers that the caller spreads onto <VideoPlayer/>. Disabled (mentors, guests,
 * non-enrolled preview viewers) → all handlers no-op so nothing is reported.
 */
export function useProgressReporter(
  lessonId: string | null,
  courseId: string,
  enabled: boolean,
): ProgressHandlers {
  const queryClient = useQueryClient()

  const unsentWatchedRef = useRef(0) // watch-time (s) accumulated but not yet sent
  const lastTickPosRef = useRef(0) // last currentTime seen, for delta computation
  const positionRef = useRef(0) // latest playback position, for the resume bookmark
  const lastSentPosRef = useRef(-1) // avoid no-op sends
  const pausedRef = useRef(true) // heartbeat only sends while playing
  const rateRef = useRef(1) // current playback rate, for the continuity threshold

  // The single choke point to the API. Reserves the delta up front so overlapping flushes
  // can't send the same seconds twice; a failure spills to the durable queue.
  const send = useCallback(
    (useBeacon: boolean) => {
      if (!enabled || !lessonId) return
      const delta = Math.floor(unsentWatchedRef.current)
      const pos = Math.floor(positionRef.current)
      if (delta <= 0 && pos === lastSentPosRef.current) return

      unsentWatchedRef.current -= delta
      lastSentPosRef.current = pos

      // Move the local progress bar immediately; the server refetch reconciles it.
      applyOptimisticProgress(queryClient, courseId, lessonId, delta, pos)

      if (useBeacon) {
        // Persist before firing: a keepalive fetch has no observable completion, so the
        // durable entry (cleared by the next successful ack) is what guarantees delivery.
        enqueue(lessonId, courseId, delta, pos)
        reportProgressBeacon(lessonId, delta, pos)
        return
      }

      void reportProgress(lessonId, delta, pos)
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: keys.courseProgress(courseId) })
          // Drain anything a prior beacon/failure left queued (beacons have no ack).
          void flush()
        })
        .catch(() => {
          // Spill to durable storage so the delta survives a reload/offline period.
          enqueue(lessonId, courseId, delta, pos)
        })
    },
    [enabled, lessonId, courseId, queryClient],
  )

  // Accumulate real play-time. A tick within BASE_STEP (scaled by rate) of the previous
  // position is continuous playback; a larger forward jump (seek) or rewind is not counted.
  const onTimeUpdate = useCallback(
    (detail: { currentTime: number }) => {
      if (!enabled) return
      const t = detail?.currentTime
      if (!Number.isFinite(t)) return
      const dt = t - lastTickPosRef.current
      const rate = rateRef.current || 1
      if (dt > 0 && dt <= BASE_STEP_SECONDS * Math.max(1, rate)) {
        unsentWatchedRef.current += dt
      }
      lastTickPosRef.current = t
      positionRef.current = t
    },
    [enabled],
  )

  const onPlay = useCallback(() => {
    pausedRef.current = false
  }, [])

  const onPause = useCallback(() => {
    pausedRef.current = true
    send(false)
  }, [send])

  // A seek must not count as watched: resync the baseline to the seek target, then flush.
  const onSeeking = useCallback(
    (detail: number) => {
      const t = Number.isFinite(detail) ? detail : positionRef.current
      lastTickPosRef.current = t
      positionRef.current = t
      send(false)
    },
    [send],
  )

  const onRateChange = useCallback((detail: number) => {
    rateRef.current = detail || 1
  }, [])

  const onEnded = useCallback(() => {
    pausedRef.current = true
    send(false)
  }, [send])

  // Reset accumulators for the new lesson, run the heartbeat while playing, and flush
  // reliably on tab-hide / unload / lesson-change (beacon). Keyed on lesson/enable only —
  // no player instance needed, so no teardown churn when the player re-renders.
  useEffect(() => {
    if (!enabled || !lessonId) return

    unsentWatchedRef.current = 0
    lastTickPosRef.current = 0
    positionRef.current = 0
    lastSentPosRef.current = -1
    pausedRef.current = true
    rateRef.current = 1

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

  return { onTimeUpdate, onPlay, onPause, onSeeking, onRateChange, onEnded }
}
