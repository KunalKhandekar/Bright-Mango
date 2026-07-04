import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Laptop, Loader2, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { getSessions, logoutAll, revokeSession } from '@/api/auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { errorMessage } from '@/lib/error-messages'
import { formatRelativeTime } from '@/lib/format'
import { keys } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth.store'

export function SessionsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const clearUser = useAuthStore((s) => s.clearUser)

  const { data, isPending } = useQuery({ queryKey: keys.sessions, queryFn: getSessions })

  const revoke = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      toast.success('Device signed out')
      void queryClient.invalidateQueries({ queryKey: keys.sessions })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const handleLogoutAll = async () => {
    try {
      await logoutAll()
    } catch {
      // Session already gone — proceed with the local sign-out.
    }
    clearUser()
    toast.success('Signed out everywhere')
    navigate('/')
  }

  const sessions = data?.sessions ?? []

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Devices"
        description="Everywhere you're currently signed in."
        actions={
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm">
                <LogOut className="size-4" /> Sign out everywhere
              </Button>
            }
            title="Sign out everywhere?"
            description="This ends every active session, including this one. You'll need to sign in again."
            confirmLabel="Sign out everywhere"
            destructive
            onConfirm={handleLogoutAll}
          />
        }
      />

      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState icon={Laptop} title="No active sessions" />
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card key={session.sessionId}>
              <CardContent className="flex items-center gap-4">
                <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-full">
                  <Laptop className="text-muted-foreground size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {session.deviceName || 'Unknown device'}
                    </p>
                    {session.current && <Badge variant="secondary">This device</Badge>}
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {session.lastSeenAt
                      ? `Active ${formatRelativeTime(session.lastSeenAt)}`
                      : 'Recently active'}
                    {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                  </p>
                </div>
                {!session.current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(session.sessionId)}
                  >
                    {revoke.isPending && revoke.variables === session.sessionId ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      'Sign out'
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
