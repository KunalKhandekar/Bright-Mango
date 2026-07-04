import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { listMyCourses } from '@/api/courses'
import { enrollManually } from '@/api/enrollments'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { errorMessage } from '@/lib/error-messages'
import { isApiError } from '@/types/api'

interface ManualEnrollDialogProps {
  /** Prefill and lock the student email (from the student detail page). */
  email?: string
  onEnrolled?: () => void
}

export function ManualEnrollDialog({ email: fixedEmail, onEnrolled }: ManualEnrollDialogProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState(fixedEmail ?? '')
  const [courseId, setCourseId] = useState('')

  // All mentor courses for the picker (first 100 is plenty for a single-mentor platform).
  const coursesQuery = useQuery({
    queryKey: ['admin', 'courses', 'picker'],
    queryFn: () => listMyCourses({ limit: 100 }),
    enabled: open,
  })

  const enroll = useMutation({
    mutationFn: () => enrollManually({ email: email.trim(), courseId }),
    onSuccess: () => {
      toast.success('Student enrolled — they got an email about it')
      setOpen(false)
      setCourseId('')
      if (!fixedEmail) setEmail('')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'student'] })
      onEnrolled?.()
    },
    onError: (err) => {
      if (isApiError(err, 'ALREADY_ENROLLED')) {
        toast.info('That student is already enrolled in this course.')
      } else {
        toast.error(errorMessage(err))
      }
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next && fixedEmail) setEmail(fixedEmail)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="size-4" /> Enroll manually
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manual enrollment</DialogTitle>
          <DialogDescription>
            Give a student free access to a course — no payment required.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="enroll-email">Student email</Label>
            <Input
              id="enroll-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!!fixedEmail}
              placeholder="student@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={coursesQuery.isPending ? 'Loading…' : 'Choose a course'}
                />
              </SelectTrigger>
              <SelectContent>
                {(coursesQuery.data?.courses ?? []).map((course) => (
                  <SelectItem key={course._id} value={course._id}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!email.trim() || !courseId || enroll.isPending}
            onClick={() => enroll.mutate()}
          >
            {enroll.isPending && <Loader2 className="size-4 animate-spin" />}
            Enroll student
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
