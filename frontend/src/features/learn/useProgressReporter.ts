import { useEffect, useRef } from 'react'
import type { MediaPlayerInstance } from '@vidstack/react'
import { useQueryClient } from '@tanstack/react-query'
import { reportProgress, reportProgressBeacon } from '@/api/progress'
import { keys } from '@/lib/query-client'

const REPORT_INTERVAL_MS = 15_000 // server rate limit is 5/10s per lesson; stay well under
// Base gap (at 1x) between two time-update ticks that still counts as continuous
// playback. Scaled by playback rate below so fast-but-continuous playback (2x, etc.)
// is still counted; only larger forward jumps (seeks) or rewinds are dropped.
const BASE_STEP_SECONDS = 2

/**
 * Reports "true watch-time" for the active lesson: only seconds actually played are
 * counted (seeks/jumps are ignored), so progress can't be gamed by scrubbing to the end.
 *
 * Accumulation (accurate) is decoupled from network sends (throttled):
 * - Every `time-update` tick adds the elapsed play-time to an unsent accumulator.
 * - The accumulated delta + current position are flushed to the server on a 15s
 *   heartbeat, on pause, on seek, on ended, on lesson change/unmount, and on page hide
 *   (via a keepalive beacon so the final seconds survive a tab/window close).
 *
 * We read playback time defensively because Vidstack's media provider may already be
 * destroyed during React effect cleanup.
 */
export function useProgressReporter(
  player: React.RefObject<MediaPlayerInstance | null>,
  lessonId: string | null,
  courseId: string,
  enabled: boolean,
) {
  const queryClient = useQueryClient()

  const unsentWatchedRef = useRef(0) // watch-time (s) accumulated but not yet sent
  const lastTickPosRef = useRef(0) // last currentTime seen, for delta computation
  const positionRef = useRef(0) // latest playback position, for the resume bookmark
  const lastSentPosRef = useRef(-1) // avoid no-op sends

  useEffect(() => {
    if (!enabled || !lessonId) return

    unsentWatchedRef.current = 0
    lastTickPosRef.current = 0
    positionRef.current = 0
    lastSentPosRef.current = -1

    /** Read current playback time safely (provider may be mid-teardown). */
    const getCurrentTime = (media: MediaPlayerInstance): number | null => {
      try {
        const currentTime = media.currentTime
        return Number.isFinite(currentTime) ? currentTime : null
      } catch {
        return null
      }
    }

    const send = (useBeacon: boolean) => {
      const delta = Math.floor(unsentWatchedRef.current)
      const pos = Math.floor(positionRef.current)
      if (delta <= 0 && pos === lastSentPosRef.current) return

      // Reserve the delta up front so overlapping flushes can't send the same seconds
      // twice; restore it only if the request fails so the next tick retries.
      unsentWatchedRef.current -= delta
      lastSentPosRef.current = pos

      if (useBeacon) {
        reportProgressBeacon(lessonId, delta, pos)
        return
      }

      void reportProgress(lessonId, delta, pos)
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: keys.courseProgress(courseId) })
        })
        .catch(() => {
          unsentWatchedRef.current += delta
        })
    }

    const media = player.current

    // Accumulate real play-time. A tick within MAX_STEP of the previous position is
    // continuous playback; anything else is a seek/rewind and is not counted.
    const unsubTime = media?.listen('time-update', () => {
      const t = getCurrentTime(media)
      if (t === null) return
      const dt = t - lastTickPosRef.current
      // Watching at 2x still advances the timeline 1:1 (just faster), so it counts as
      // fully watched. Scale the continuity threshold by playback rate so a fast tick
      // isn't misread as a seek; genuine seeks still exceed it.
      let rate = 1
      try {
        rate = media.playbackRate || 1
      } catch {
        rate = 1
      }
      if (!media.paused && dt > 0 && dt <= BASE_STEP_SECONDS * Math.max(1, rate)) {
        unsentWatchedRef.current += dt
      }
      lastTickPosRef.current = t
      positionRef.current = t
    })

    // A seek must not count as watched: resync the baseline, then flush what we have.
    const unsubSeeking = media?.listen('seeking', () => {
      const t = getCurrentTime(media)
      if (t !== null) {
        lastTickPosRef.current = t
        positionRef.current = t
      }
      send(false)
    })

    const unsubPause = media?.listen('pause', () => {
      const t = getCurrentTime(media)
      if (t !== null) positionRef.current = t
      send(false)
    })

    const unsubEnd = media?.listen('ended', () => {
      try {
        const duration = media.duration
        if (Number.isFinite(duration) && duration > 0) positionRef.current = duration
      } catch {
        // provider destroyed; keep the last known position
      }
      send(false)
    })

    // Heartbeat while playing.
    const interval = window.setInterval(() => {
      const current = player.current
      if (!current) return
      try {
        if (current.paused) return
        send(false)
      } catch {
        // provider mid-teardown
      }
    }, REPORT_INTERVAL_MS)

    // Flush reliably when the tab is hidden or the page is being unloaded.
    const onHide = () => {
      if (document.visibilityState === 'hidden') send(true)
    }
    const onPageHide = () => send(true)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      window.clearInterval(interval)
      unsubTime?.()
      unsubSeeking?.()
      unsubPause?.()
      unsubEnd?.()
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)

      // Final flush for the lesson we're leaving. Use a beacon and only the cached
      // position ref — do NOT touch player.current here, its provider may be null.
      send(true)
    }
  }, [player, lessonId, courseId, enabled, queryClient])
}
