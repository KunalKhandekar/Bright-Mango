import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, ShieldOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { blacklistEmail, listBlacklist, removeBlacklistedEmail } from '@/api/users'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { errorMessage } from '@/lib/error-messages'
import { formatDate } from '@/lib/format'

const BLACKLIST_KEY = ['admin', 'blacklist'] as const

export function BlacklistPage() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')

  const { data, isPending } = useQuery({ queryKey: BLACKLIST_KEY, queryFn: listBlacklist })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: BLACKLIST_KEY })

  const add = useMutation({
    mutationFn: () => blacklistEmail({ email: email.trim(), reason: reason.trim() || undefined }),
    onSuccess: () => {
      toast.success('Email blacklisted — any matching account is banned')
      setEmail('')
      setReason('')
      void invalidate()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const remove = useMutation({
    mutationFn: removeBlacklistedEmail,
    onSuccess: () => {
      toast.success('Removed from blacklist')
      void invalidate()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const entries = data?.entries ?? []

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/admin/students">
          <ArrowLeft className="size-4" /> Students
        </Link>
      </Button>

      <PageHeader
        title="Email blacklist"
        description="Blocked addresses can't sign up or sign in; matching accounts are banned."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Block an email</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              if (email.trim()) add.mutate()
            }}
          >
            <Input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
            <Button type="submit" disabled={!email.trim() || add.isPending}>
              {add.isPending && <Loader2 className="size-4 animate-spin" />}
              Block
            </Button>
          </form>
        </CardContent>
      </Card>

      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : entries.length === 0 ? (
        <EmptyState icon={ShieldOff} title="No blacklisted emails" />
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry._id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{entry.email}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {entry.reason || 'No reason given'} · {formatDate(entry.createdAt)}
                </p>
              </div>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label="Remove from blacklist">
                    <Trash2 className="size-4" />
                  </Button>
                }
                title={`Unblock ${entry.email}?`}
                description="They'll be able to sign in again (a banned account stays banned until unbanned)."
                confirmLabel="Unblock"
                onConfirm={() => remove.mutateAsync(entry.email).then(() => undefined)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
