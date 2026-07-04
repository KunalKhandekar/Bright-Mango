import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth.store'

function FullPageLoader() {
  return (
    <div className="flex min-h-svh flex-col gap-4 p-6">
      <Skeleton className="h-14 w-full" />
      <div className="mx-auto mt-8 flex w-full max-w-4xl flex-col gap-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}

export function RequireAuth() {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()

  if (status === 'loading') return <FullPageLoader />
  if (status === 'guest') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <Outlet />
}

export function RequireMentor() {
  const { status, user } = useAuthStore()
  const location = useLocation()

  if (status === 'loading') return <FullPageLoader />
  if (status === 'guest') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (user?.role !== 'mentor') return <Navigate to="/" replace />
  return <Outlet />
}

export function RedirectIfAuthed() {
  const { status, user } = useAuthStore()
  const [searchParams] = useSearchParams()

  if (status === 'loading') return <FullPageLoader />
  if (status === 'authed') {
    const next = searchParams.get('next')
    // Only allow same-app relative paths to avoid open redirects.
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null
    return (
      <Navigate to={safeNext ?? (user?.role === 'mentor' ? '/admin' : '/dashboard')} replace />
    )
  }
  return <Outlet />
}
