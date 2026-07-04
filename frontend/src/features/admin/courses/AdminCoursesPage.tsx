import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus } from 'lucide-react'
import { listMyCourses } from '@/api/courses'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Paginator } from '@/components/shared/Paginator'
import { formatDate, formatPrice } from '@/lib/format'
import { keys } from '@/lib/query-client'
import type { CourseStatus } from '@/types/models'
import { CourseFormDialog } from '@/features/admin/courses/CourseFormDialog'

export const COURSE_STATUS_META: Record<
  CourseStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  published: { label: 'Published', variant: 'default' },
  draft: { label: 'Draft', variant: 'secondary' },
  scheduled_delete: { label: 'Deleting soon', variant: 'destructive' },
}

export function AdminCoursesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isPending } = useQuery({
    queryKey: keys.adminCourses(page),
    queryFn: () => listMyCourses({ page }),
  })
  const courses = data?.courses ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Courses"
        description="Everything you teach, in one place."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New course
          </Button>
        }
      />

      {isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="Create your first course to start teaching."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> New course
            </Button>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => (
                  <TableRow
                    key={course._id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/admin/courses/${course._id}`)}
                  >
                    <TableCell className="max-w-72">
                      <p className="truncate font-medium">{course.title}</p>
                      <p className="text-muted-foreground truncate text-xs">/{course.slug}</p>
                    </TableCell>
                    <TableCell>{formatPrice(course.price)}</TableCell>
                    <TableCell>
                      <Badge variant={COURSE_STATUS_META[course.status].variant}>
                        {COURSE_STATUS_META[course.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDate(course.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {data?.meta && <Paginator meta={data.meta} onPageChange={setPage} />}
        </>
      )}

      <CourseFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(course) => {
          void queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] })
          navigate(`/admin/courses/${course._id}`)
        }}
      />
    </div>
  )
}
