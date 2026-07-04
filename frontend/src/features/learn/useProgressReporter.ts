import { useEffect, useRef } from 'react'
import type { MediaPlayerInstance } from '@vidstack/react'
import { useQueryClient } from '@tanstack/react-query'
import { reportProgress } from '@/api/progress'
import { keys } from '@/lib/query-client'

const REPORT_INTERVAL_MS = 15_000 // server rate limit is 5/10s per lesson; stay well under

/**
 * Reports watched seconds for the active lesson: every 15s while playing,
 * plus a flush on pause and on lesson change/unmount. Progress is monotonic
 * server-side, so over-reporting a stale value is harmless.
 */
export function useProgressReporter(
  player: React.RefObject<MediaPlayerInstance | null>,
  lessonId: string | null,
  courseId: string,
  enabled: boolean,
) {
  const queryClient = useQueryClient()
  const lastSentRef = useRef(0)

  useEffect(() => {
    if (!enabled || !lessonId) return
    lastSentRef.current = 0

    const send = (seconds: number) => {
      const value = Math.floor(seconds)
      if (value <= 0 || value === lastSentRef.current) return
      lastSentRef.current = value
      reportProgress(lessonId, value)
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: keys.courseProgress(courseId) })
        })
        .catch(() => {
          // Rate limited or transient failure — the next tick will catch up.
          lastSentRef.current = 0
        })
    }

    const interval = setInterval(() => {
      const media = player.current
      if (media && !media.paused) send(media.currentTime)
    }, REPORT_INTERVAL_MS)

    const media = player.current
    const unsubPause = media?.listen('pause', () => send(media.currentTime))
    const unsubEnd = media?.listen('ended', () => send(media.duration))

    return () => {
      clearInterval(interval)
      unsubPause?.()
      unsubEnd?.()
      // Flush on lesson change / unmount.
      const current = player.current
      if (current && current.currentTime > 0) send(current.currentTime)
    }
  }, [player, lessonId, courseId, enabled, queryClient])
}
