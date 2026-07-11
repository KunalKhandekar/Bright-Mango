import { reportProgress } from '@/api/progress'
import { keys, queryClient } from '@/lib/query-client'
import { isApiError } from '@/types/api'

/**
 * Durable, replay-safe queue for progress reports that haven't been acknowledged by the
 * server yet. It exists so a failed request, a browser refresh, or an offline period never
 * loses watch-time.
 *
 * Safety model: `deltaSeconds` is additive and the backend caps `watchedSeconds` at the
 * lesson duration (and completion is sticky), so replaying or duplicating a delta can only
 * over-count harmlessly up to 100%. That makes a persistent accumulator safe to retry.
 *
 * Storage is `localStorage` (not IndexedDB): payloads are tiny and, critically, the page
 * `unload`/`pagehide` beacon path is synchronous — we must be able to write-before-send
 * without awaiting. All access is wrapped in try/catch so quota/private-mode failures
 * degrade to the in-memory behaviour rather than throwing into the player.
 */

const STORAGE_KEY = 'bm:progress:pending'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // drop entries older than a week on load
const BACKOFF_MS = [2_000, 4_000, 8_000, 16_000, 30_000]

export interface PendingProgress {
  lessonId: string
  courseId: string
  deltaSeconds: number
  positionSeconds: number
  updatedAt: number
}

type PendingMap = Record<string, PendingProgress>

function readMap(): PendingMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as PendingMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(map: PendingMap): void {
  try {
    if (Object.keys(map).length === 0) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Quota exceeded / private mode — best effort only.
  }
}

/**
 * Merge a report into the persistent queue. Deltas sum (matching the backend's
 * `watchedSeconds += delta`); the position takes the max so a queued flush never rewinds
 * the resume bookmark. Re-reads before writing so concurrent tabs stay consistent.
 */
export function enqueue(
  lessonId: string,
  courseId: string,
  deltaSeconds: number,
  positionSeconds: number,
): void {
  const delta = Math.max(0, Math.floor(deltaSeconds))
  const pos = Math.max(0, Math.floor(positionSeconds))
  const map = readMap()
  const existing = map[lessonId]
  map[lessonId] = {
    lessonId,
    courseId,
    deltaSeconds: (existing?.deltaSeconds ?? 0) + delta,
    positionSeconds: Math.max(existing?.positionSeconds ?? 0, pos),
    updatedAt: Date.now(),
  }
  writeMap(map)
}

export function peekAll(): PendingProgress[] {
  return Object.values(readMap())
}

/**
 * Acknowledge a flushed report by subtracting the amount that was sent. The key is only
 * deleted once fully drained, so deltas accumulated *while the request was in flight*
 * (a concurrent tick that enqueued more) are preserved for the next flush.
 */
export function remove(lessonId: string, ackedDelta: number, ackedPos: number): void {
  const map = readMap()
  const entry = map[lessonId]
  if (!entry) return
  const remaining = entry.deltaSeconds - Math.max(0, Math.floor(ackedDelta))
  if (remaining <= 0 && entry.positionSeconds <= ackedPos) {
    delete map[lessonId]
  } else {
    map[lessonId] = { ...entry, deltaSeconds: Math.max(0, remaining) }
  }
  writeMap(map)
}

function drop(lessonId: string): void {
  const map = readMap()
  if (map[lessonId]) {
    delete map[lessonId]
    writeMap(map)
  }
}

/** A 4xx (except 429) will never succeed on retry — drop it instead of looping forever. */
function isPermanentFailure(error: unknown): boolean {
  return (
    isApiError(error) &&
    error.statusCode >= 400 &&
    error.statusCode < 500 &&
    error.errorCode !== 'RATE_LIMITED'
  )
}

let flushing = false
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryAttempt = 0

/**
 * Drain the queue sequentially. On a transient failure it stops and schedules a retry with
 * exponential backoff; on a permanent (4xx) failure it drops that entry. Sequential draining
 * naturally spaces per-lesson sends under the server's rate limit (5/10s per lesson).
 */
export async function flush(): Promise<void> {
  if (flushing) return
  flushing = true
  try {
    const touchedCourses = new Set<string>()
    let scheduleRetry = false

    for (const entry of peekAll()) {
      if (entry.deltaSeconds <= 0 && entry.positionSeconds <= 0) {
        drop(entry.lessonId)
        continue
      }
      try {
        await reportProgress(entry.lessonId, entry.deltaSeconds, entry.positionSeconds)
        remove(entry.lessonId, entry.deltaSeconds, entry.positionSeconds)
        touchedCourses.add(entry.courseId)
      } catch (error) {
        if (isPermanentFailure(error)) {
          drop(entry.lessonId)
          continue
        }
        scheduleRetry = true
        break // transient (network / 5xx / 429) — back off and try the rest later
      }
    }

    for (const courseId of touchedCourses) {
      void queryClient.invalidateQueries({ queryKey: keys.courseProgress(courseId) })
    }

    if (scheduleRetry) {
      scheduleFlushRetry()
    } else {
      retryAttempt = 0
    }
  } finally {
    flushing = false
  }
}

function scheduleFlushRetry(): void {
  if (retryTimer) return
  const delay = BACKOFF_MS[Math.min(retryAttempt, BACKOFF_MS.length - 1)]
  retryAttempt += 1
  retryTimer = setTimeout(() => {
    retryTimer = null
    void flush()
  }, delay)
}

/** Discard entries left by a crash that are too old to be meaningful. */
function pruneStale(): void {
  const map = readMap()
  const cutoff = Date.now() - MAX_AGE_MS
  let changed = false
  for (const [lessonId, entry] of Object.entries(map)) {
    if (entry.updatedAt < cutoff) {
      delete map[lessonId]
      changed = true
    }
  }
  if (changed) writeMap(map)
}

/**
 * Wire up automatic draining: once now (to recover anything a prior crash/unload left), and
 * whenever connectivity is restored. Returns a cleanup function. Safe to mount from a hook.
 */
export function startAutoFlush(): () => void {
  pruneStale()
  void flush()
  const onOnline = () => {
    retryAttempt = 0
    void flush()
  }
  window.addEventListener('online', onOnline)
  return () => window.removeEventListener('online', onOnline)
}
