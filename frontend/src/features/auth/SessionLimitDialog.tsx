import { useState } from 'react'
import { Laptop, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/format'
import type { Session } from '@/types/models'

interface SessionLimitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessions: Session[]
  /** Called with the session the user chose to sign out; resolves when the retry finishes. */
  onRevoke: (sessionId: string) => Promise<void>
}

export function SessionLimitDialog({
  open,
  onOpenChange,
  sessions,
  onRevoke,
}: SessionLimitDialogProps) {
  const [busyId, setBusyId] = useState<string | null>(null)

  return (
    <Dialog open={open} onOpenChange={(next) => !busyId && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Too many devices</DialogTitle>
          <DialogDescription>
            You're signed in on the maximum number of devices. Sign out of one to continue here.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li
              key={session.sessionId}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full">
                <Laptop className="text-muted-foreground size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {session.deviceName || 'Unknown device'}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {session.lastSeenAt
                    ? `Active ${formatRelativeTime(session.lastSeenAt)}`
                    : 'Recently active'}
                  {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busyId !== null}
                onClick={async () => {
                  setBusyId(session.sessionId)
                  try {
                    await onRevoke(session.sessionId)
                  } finally {
                    setBusyId(null)
                  }
                }}
              >
                {busyId === session.sessionId && <Loader2 className="size-3.5 animate-spin" />}
                Sign out
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
