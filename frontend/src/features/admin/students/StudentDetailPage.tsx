import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Laptop, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getStudentSessions,
  revokeAllStudentSessions,
  revokeStudentSession,
} from '@/api/auth'
import { revokeEnrollment } from '@/api/enrollments'
import { banStudent, getStudent, getStudentEnrollments, unbanStudent } from '@/api/users'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { errorMessage } from '@/lib/error-messages'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { keys } from '@/lib/query-client'
import { refId } from '@/types/models'
import { ManualEnrollDialog } from '@/features/admin/students/ManualEnrollDialog'

export function StudentDetailPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()

  const studentQuery = useQuery({
    queryKey: keys.adminStudent(id),
    queryFn: () => getStudent(id),
  })
  const enrollmentsQuery = useQuery({
    queryKey: keys.adminStudentEnrollments(id),
    queryFn: () => getStudentEnrollments(id),
  })
  const sessionsQuery = useQuery({
    queryKey: keys.adminStudentSessions(id),
    queryFn: () => getStudentSessions(id),
  })

  const student = studentQuery.data?.student

  const invalidateStudent = () => {
    void queryClient.invalidateQueries({ queryKey: keys.adminStudent(id) })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'students'] })
  }

  const toggleBan = useMutation({
    mutationFn: () => (student?.status === 'banned' ? unbanStudent(id) : banStudent(id)),
    onSuccess: () => {
      toast.success(student?.status === 'banned' ? 'Student unbanned' : 'Student banned')
      invalidateStudent()
      void queryClient.invalidateQueries({ queryKey: keys.adminStudentSessions(id) })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const revokeOne = useMutation({
    mutationFn: (sessionId: string) => revokeStudentSession(id, sessionId),
    onSuccess: () => {
      toast.success('Session revoked')
      void queryClient.invalidateQueries({ queryKey: keys.adminStudentSessions(id) })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const revokeAll = useMutation({
    mutationFn: () => revokeAllStudentSessions(id),
    onSuccess: ({ revoked }) => {
      toast.success(`Signed out of ${revoked} device${revoked === 1 ? '' : 's'}`)
      void queryClient.invalidateQueries({ queryKey: keys.adminStudentSessions(id) })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const revokeEnr = useMutation({
    mutationFn: revokeEnrollment,
    onSuccess: () => {
      toast.success('Enrollment revoked')
      void queryClient.invalidateQueries({ queryKey: keys.adminStudentEnrollments(id) })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  if (studentQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-1/2" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!student) {
    return (
      <EmptyState
        title="Student not found"
        action={
          <Button asChild variant="outline">
            <Link to="/admin/students">Back to students</Link>
          </Button>
        }
      />
    )
  }

  const enrollments = enrollmentsQuery.data?.enrollments ?? []
  const sessions = sessionsQuery.data?.sessions ?? []
  const banned = student.status === 'banned'

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/admin/students">
          <ArrowLeft className="size-4" /> All students
        </Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <UserAvatar
            name={student.name}
            email={student.email}
            avatar={student.avatar}
            className="size-14"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{student.name || 'Unnamed student'}</h1>
              <Badge variant={banned ? 'destructive' : 'secondary'}>{student.status}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">{student.email}</p>
            <p className="text-muted-foreground text-xs">
              Joined {formatDate(student.createdAt)}
              {student.lastLoginAt ? ` · last login ${formatRelativeTime(student.lastLoginAt)}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ManualEnrollDialog
            email={student.email}
            enrolledCourseIds={enrollments.map((e) => refId(e.courseId))}
          />
          <ConfirmDialog
            trigger={
              <Button variant={banned ? 'outline' : 'destructive'} size="sm">
                {banned ? <ShieldCheck className="size-4" /> : <Ban className="size-4" />}
                {banned ? 'Unban' : 'Ban'}
              </Button>
            }
            title={banned ? 'Unban this student?' : 'Ban this student?'}
            description={
              banned
                ? 'They will be able to sign in and access their courses again.'
                : 'They will be signed out everywhere and blocked from signing in.'
            }
            confirmLabel={banned ? 'Unban' : 'Ban student'}
            destructive={!banned}
            onConfirm={() => toggleBan.mutateAsync().then(() => undefined)}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            {enrollments.length === 0 ? (
              <p className="text-muted-foreground text-sm">Not enrolled in any course.</p>
            ) : (
              <ul className="space-y-2">
                {enrollments.map((enrollment) => (
                  <li
                    key={enrollment._id}
                    className="flex items-center gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {typeof enrollment.courseId === 'object'
                          ? enrollment.courseId.title
                          : 'Course'}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {enrollment.accessType === 'manual' ? 'Granted manually' : 'Purchased'} ·{' '}
                        {formatDate(enrollment.enrolledAt)}
                      </p>
                    </div>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label="Revoke enrollment">
                          <Trash2 className="size-4" />
                        </Button>
                      }
                      title="Revoke this enrollment?"
                      description="The student loses access to the course content immediately."
                      confirmLabel="Revoke"
                      destructive
                      onConfirm={() => revokeEnr.mutateAsync(enrollment._id).then(() => undefined)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Active devices</CardTitle>
            {sessions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={revokeAll.isPending}
                onClick={() => revokeAll.mutate()}
              >
                Sign out all
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active sessions.</p>
            ) : (
              <ul className="space-y-2">
                {sessions.map((session) => (
                  <li
                    key={session.sessionId}
                    className="flex items-center gap-3 rounded-md border p-3"
                  >
                    <Laptop className="text-muted-foreground size-4 shrink-0" />
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
                      variant="ghost"
                      size="sm"
                      disabled={revokeOne.isPending}
                      onClick={() => revokeOne.mutate(session.sessionId)}
                    >
                      Sign out
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
