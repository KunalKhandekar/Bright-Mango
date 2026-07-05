import { useEffect, useRef } from 'react'
import type { MediaPlayerInstance } from '@vidstack/react'
import { useQueryClient } from '@tanstack/react-query'
import { reportProgress } from '@/api/progress'
import { keys } from '@/lib/query-client'

const REPORT_INTERVAL_MS = 15_000 // server rate limit is 5/10s per lesson; stay well under

/**
 * Reports watched seconds for the active lesson:
 *
 * - Every 15 seconds while the video is playing
 * - When the video is paused
 * - When the video ends
 * - When the lesson changes or the component unmounts
 *
 * We cache the last known playback time because Vidstack's internal
 * media provider may already be destroyed during React effect cleanup.
 */
export function useProgressReporter(
  player: React.RefObject<MediaPlayerInstance | null>,
  lessonId: string | null,
  courseId: string,
  enabled: boolean,
) {
  const queryClient = useQueryClient()

  const lastSentRef = useRef(0)
  const lastKnownTimeRef = useRef(0)

  useEffect(() => {
    if (!enabled || !lessonId) return

    lastSentRef.current = 0
    lastKnownTimeRef.current = 0

    const send = (seconds: number) => {
      const value = Math.floor(seconds)

      if (
        !Number.isFinite(value) ||
        value <= 0 ||
        value === lastSentRef.current
      ) {
        return
      }

      lastSentRef.current = value

      void reportProgress(lessonId, value)
        .then(() => {
          void queryClient.invalidateQueries({
            queryKey: keys.courseProgress(courseId),
          })
        })
        .catch(() => {
          // Allow the next interval/event to retry.
          lastSentRef.current = 0
        })
    }

    /**
     * Read current playback time safely.
     *
     * Vidstack's MediaPlayerInstance can still exist while its internal
     * provider has already been destroyed, so property access can throw.
     */
    const getCurrentTime = (
      media: MediaPlayerInstance,
    ): number | null => {
      try {
        const currentTime = media.currentTime

        if (!Number.isFinite(currentTime)) {
          return null
        }

        return currentTime
      } catch {
        return null
      }
    }

    /**
     * Report progress every 15 seconds while playing.
     */
    const interval = window.setInterval(() => {
      const media = player.current

      if (!media) return

      try {
        if (media.paused) return

        const currentTime = getCurrentTime(media)

        if (currentTime === null) return

        lastKnownTimeRef.current = currentTime
        send(currentTime)
      } catch {
        // Vidstack provider may be in the process of being destroyed.
      }
    }, REPORT_INTERVAL_MS)

    /**
     * Capture the current player instance for event subscriptions.
     */
    const media = player.current

    const unsubPause = media?.listen('pause', () => {
      const currentTime = getCurrentTime(media)

      if (currentTime === null) return

      lastKnownTimeRef.current = currentTime
      send(currentTime)
    })

    const unsubEnd = media?.listen('ended', () => {
      try {
        const duration = media.duration

        if (!Number.isFinite(duration) || duration <= 0) return

        lastKnownTimeRef.current = duration
        send(duration)
      } catch {
        // Vidstack provider has already been destroyed.
      }
    })

    return () => {
      window.clearInterval(interval)

      unsubPause?.()
      unsubEnd?.()

      /**
       * Important:
       * Do not access player.current.currentTime here.
       *
       * During unmount, Vidstack's internal provider can already be null,
       * which causes:
       *
       * Cannot read properties of null (reading 'currentTime')
       */
      const lastKnownTime = lastKnownTimeRef.current

      if (lastKnownTime > 0) {
        send(lastKnownTime)
      }
    }
  }, [
    player,
    lessonId,
    courseId,
    enabled,
    queryClient,
  ])
}