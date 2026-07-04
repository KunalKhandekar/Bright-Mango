import { useEffect } from 'react'
import { getMe, heartbeat } from '@/api/auth'
import { useAuthStore } from '@/stores/auth.store'

const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000

/**
 * Hydrates the auth store from GET /auth/me on mount and keeps the
 * sliding session TTL alive with a periodic heartbeat while authed.
 */
export function useAuthBootstrap() {
  const status = useAuthStore((s) => s.status)

  useEffect(() => {
    getMe()
      .then(({ user }) => useAuthStore.getState().setUser(user))
      .catch(() => useAuthStore.getState().clearUser())
  }, [])

  useEffect(() => {
    if (status !== 'authed') return
    const id = setInterval(() => {
      heartbeat().catch(() => {
        // 401 handling in the axios interceptor clears auth state.
      })
    }, HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [status])
}
