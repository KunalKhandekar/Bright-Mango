import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, ShieldAlert, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  cancelCourseDeletion,
  confirmCourseDeletion,
  requestCourseDeletion,
} from '@/api/courses'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { errorMessage } from '@/lib/error-messages'
import {
  formatCountdown,
  formatDateTime,
  formatDateTimeWithSeconds,
  formatMinutesWindow,
} from '@/lib/format'
import type { Course } from '@/types/models'

/** Live-ticking countdown to the scheduled deletion moment. */
function DeletionCountdown({ executeAt }: { executeAt: string }) {
  const target = new Date(executeAt).getTime()
  const [remaining, setRemaining] = useState(() => target - Date.now())

  useEffect(() => {
    setRemaining(target - Date.now())
    const id = setInterval(() => setRemaining(target - Date.now()), 1000)
    return () => clearInterval(id)
  }, [target])

  if (remaining <= 0) return <>Deletion is being processed…</>
  return (
    <>
      It will be permanently removed on{' '}
      <span className="font-medium">{formatDateTimeWithSeconds(executeAt)}</span> — in{' '}
      <span className="font-medium tabular-nums">{formatCountdown(remaining)}</span> — unless you
      cancel.
    </>
  )
}

/** Banner shown while the course is scheduled for deletion, with cancel. */
export function DeletionScheduledBanner({ course }: { course: Course }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  if (course.status !== 'scheduled_delete') return null

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 sm:flex-row sm:items-center">
      <ShieldAlert className="text-destructive size-5 shrink-0" />
      <div className="flex-1 text-sm">
        <p className="font-medium">This course is scheduled for deletion</p>
        <p className="text-muted-foreground">
          {course.scheduledDeleteAt ? (
            <DeletionCountdown executeAt={course.scheduledDeleteAt} />
          ) : (
            'It will be permanently removed soon unless you cancel.'
          )}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await cancelCourseDeletion(course._id)
            toast.success('Deletion cancelled')
            void queryClient.invalidateQueries({ queryKey: ['admin', 'course', course._id] })
            void queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] })
          } catch (err) {
            toast.error(errorMessage(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <Undo2 className="size-4" /> Cancel deletion
      </Button>
    </div>
  )
}

/** OTP-protected deletion: request emails a code to the mentor, confirm schedules it. */
export function DeleteCourseButton({ course }: { course: Course }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [otp, setOtp] = useState('')
  const [phase, setPhase] = useState<'idle' | 'requesting' | 'awaiting-otp' | 'confirming'>(
    'idle',
  )
  const [error, setError] = useState<string | null>(null)
  const [delayMinutes, setDelayMinutes] = useState<number | null>(null)

  const start = async () => {
    setOpen(true)
    setOtp('')
    setError(null)
    setPhase('requesting')
    try {
      const { delayMinutes: delay } = await requestCourseDeletion(course._id)
      setDelayMinutes(delay ?? null)
      setPhase('awaiting-otp')
    } catch (err) {
      setError(errorMessage(err))
      setPhase('idle')
    }
  }

  const confirm = async () => {
    setPhase('confirming')
    setError(null)
    try {
      const { executeAt } = await confirmCourseDeletion(course._id, otp)
      toast.success(
        `Deletion scheduled${executeAt ? ` for ${formatDateTime(executeAt)}` : ''}. You can cancel until then.`,
      )
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'course', course._id] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] })
    } catch (err) {
      setError(errorMessage(err))
      setPhase('awaiting-otp')
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" className="text-destructive" onClick={start}>
        <Trash2 className="size-4" /> Delete course
      </Button>
      <Dialog open={open} onOpenChange={(next) => phase !== 'confirming' && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete "{course.title}"?</DialogTitle>
            <DialogDescription>
              For safety we emailed a 6-digit code to your account. Deletion happens{' '}
              {delayMinutes ? formatMinutesWindow(delayMinutes) : 'a while'} after confirmation
              and can be cancelled until then.
            </DialogDescription>
          </DialogHeader>
          {phase === 'requesting' ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm">
              <Loader2 className="size-4 animate-spin" /> Sending code…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {error && <p className="text-destructive text-center text-sm">{error}</p>}
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Keep course
                </Button>
                <Button
                  variant="destructive"
                  disabled={otp.length !== 6 || phase === 'confirming'}
                  onClick={confirm}
                >
                  {phase === 'confirming' && <Loader2 className="size-4 animate-spin" />}
                  Schedule deletion
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
