import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpenCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { listMyCourses } from '@/api/courses'
import { getEnrollmentStats, listAdminEnrollments, revokeEnrollment } from '@/api/enrollments'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Paginator } from '@/components/shared/Paginator'
import { SearchInput } from '@/components/shared/SearchInput'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { ManualEnrollDialog } from '@/features/admin/students/ManualEnrollDialog'
import { errorMessage } from '@/lib/error-messages'
import { formatDate } from '@/lib/format'
import { keys } from '@/lib/query-client'

/** Select sentinel for "every course" (Radix Select cannot hold an empty-string value). */
const ALL_COURSES = '__all__'

export function EnrollmentsPage() {
  const queryClient = useQueryClient()
  const [courseId, setCourseId] = useState(ALL_COURSES)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filters = {
    courseId: courseId === ALL_COURSES ? undefined : courseId,
    search: search || undefined,
  }

  const statsQuery = useQuery({
    queryKey: keys.adminEnrollmentStats,
    queryFn: getEnrollmentStats,
  })
  const coursesQuery = useQuery({
    queryKey: ['admin', 'courses', 'picker'],
    queryFn: () => listMyCourses({ limit: 100 }),
  })
  const { data, isPending } = useQuery({
    queryKey: keys.adminEnrollments({ ...filters, page }),
    queryFn: () => listAdminEnrollments({ ...filters, page }),
  })
  const enrollments = data?.enrollments ?? []

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'enrollments'] })
  }

  const revoke = useMutation({
    mutationFn: revokeEnrollment,
    onSuccess: () => {
      toast.success('Enrollment revoked')
      invalidate()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const selectedCourseCount =
    courseId === ALL_COURSES
      ? statsQuery.data?.total
      : statsQuery.data?.byCourse.find((c) => c.courseId === courseId)?.count

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enrollments"
        description={
          statsQuery.data
            ? `${statsQuery.data.total} total enrollment${statsQuery.data.total === 1 ? '' : 's'} across your courses.`
            : 'Who has access to which course, and how far they\'ve gotten.'
        }
        actions={<ManualEnrollDialog onEnrolled={invalidate} />}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={courseId}
          onValueChange={(v) => {
            setCourseId(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_COURSES}>All courses</SelectItem>
            {(coursesQuery.data?.courses ?? []).map((course) => {
              const count = statsQuery.data?.byCourse.find((c) => c.courseId === course._id)?.count
              return (
                <SelectItem key={course._id} value={course._id}>
                  {course.title}
                  {count !== undefined ? ` (${count})` : ''}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          placeholder="Search by student name or email…"
          className="w-full sm:max-w-xs"
        />
        {courseId !== ALL_COURSES && selectedCourseCount !== undefined && (
          <span className="text-muted-foreground text-sm">
            {selectedCourseCount} enrollment{selectedCourseCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : enrollments.length === 0 ? (
        <EmptyState
          icon={BookOpenCheck}
          title="No enrollments found"
          description={
            filters.courseId || filters.search
              ? 'Try removing the filters.'
              : 'Enroll a student manually or wait for the first purchase.'
          }
          action={<ManualEnrollDialog onEnrolled={invalidate} />}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead className="min-w-40">Progress</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((enrollment) => (
                  <TableRow key={enrollment._id}>
                    <TableCell>
                      <Link
                        to={`/admin/students/${enrollment.studentId._id}`}
                        className="flex items-center gap-3 hover:underline"
                      >
                        <UserAvatar
                          name={enrollment.studentId.name}
                          email={enrollment.studentId.email}
                          avatar={enrollment.studentId.avatar}
                          className="size-8"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {enrollment.studentId.name || '—'}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {enrollment.studentId.email}
                          </span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-56 truncate">
                      {enrollment.courseId?.title ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={enrollment.accessType === 'paid' ? 'default' : 'secondary'}>
                        {enrollment.accessType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDate(enrollment.enrolledAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={enrollment.progressPercentage} className="w-24" />
                        <span className="text-muted-foreground w-9 text-right text-xs">
                          {enrollment.progressPercentage}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon" aria-label="Revoke enrollment">
                            <Trash2 className="size-4" />
                          </Button>
                        }
                        title="Revoke this enrollment?"
                        description="The student loses access, and their progress and comments in this course are deleted."
                        confirmLabel="Revoke"
                        destructive
                        onConfirm={async () => {
                          await revoke.mutateAsync(enrollment._id)
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {data?.meta && <Paginator meta={data.meta} onPageChange={setPage} />}
        </>
      )}
    </div>
  )
}
