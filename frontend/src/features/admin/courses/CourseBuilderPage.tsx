import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Loader2, Pencil, Rocket } from 'lucide-react'
import { toast } from 'sonner'
import { getAdminCourse, publishCourse } from '@/api/courses'
import { listChapters } from '@/api/chapters'
import { listLessonsByCourse } from '@/api/lessons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { errorMessage } from '@/lib/error-messages'
import { formatPrice } from '@/lib/format'
import { keys } from '@/lib/query-client'
import { isApiError } from '@/types/api'
import type { Lesson } from '@/types/models'
import { COURSE_STATUS_META } from '@/features/admin/courses/AdminCoursesPage'
import { ChapterList } from '@/features/admin/courses/ChapterList'
import { CourseFormDialog } from '@/features/admin/courses/CourseFormDialog'
import {
  DeleteCourseButton,
  DeletionScheduledBanner,
} from '@/features/admin/courses/DeleteCourseFlow'
import { LessonEditDialog } from '@/features/admin/courses/LessonEditDialog'

export function CourseBuilderPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)

  const courseQuery = useQuery({
    queryKey: keys.adminCourse(id),
    queryFn: () => getAdminCourse(id),
  })
  const course = courseQuery.data?.course

  const chaptersQuery = useQuery({
    queryKey: keys.chapters(id),
    queryFn: () => listChapters(id),
    enabled: !!course,
  })
  const lessonsQuery = useQuery({
    queryKey: keys.lessonsByCourse(id),
    queryFn: () => listLessonsByCourse(id),
    enabled: !!course,
    // Keep polling while any video is encoding so status badges update live.
    refetchInterval: (query) =>
      query.state.data?.lessons.some((l) => l.videoStatus === 'processing') ? 8_000 : false,
  })

  const publish = useMutation({
    mutationFn: () => publishCourse(id),
    onSuccess: () => {
      toast.success('Course published — students can now enroll 🎉')
      void queryClient.invalidateQueries({ queryKey: keys.adminCourse(id) })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] })
    },
    onError: (err) => {
      if (isApiError(err, 'COURSE_NOT_PUBLISHABLE')) {
        toast.error('Add at least one lesson before publishing.')
      } else {
        toast.error(errorMessage(err))
      }
    },
  })

  if (courseQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!course) {
    return (
      <EmptyState
        title="Course not found"
        action={
          <Button asChild variant="outline">
            <Link to="/admin/courses">Back to courses</Link>
          </Button>
        }
      />
    )
  }

  const chapters = chaptersQuery.data?.chapters ?? []
  const lessons = lessonsQuery.data?.lessons ?? []
  const statusMeta = COURSE_STATUS_META[course.status]

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/admin/courses">
            <ArrowLeft className="size-4" /> All courses
          </Link>
        </Button>

        <DeletionScheduledBanner course={course} />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{course.title}</h1>
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {formatPrice(course.price)} · /{course.slug}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {course.status === 'published' && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/courses/${course.slug}`} target="_blank">
                  <ExternalLink className="size-4" /> View live
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" /> Edit details
            </Button>
            {course.status === 'draft' && (
              <Button size="sm" disabled={publish.isPending} onClick={() => publish.mutate()}>
                {publish.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Rocket className="size-4" />
                )}
                Publish
              </Button>
            )}
            {course.status !== 'scheduled_delete' && <DeleteCourseButton course={course} />}
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Curriculum</h2>
        {chaptersQuery.isPending || lessonsQuery.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <ChapterList
            courseId={id}
            chapters={chapters}
            lessons={lessons}
            onEditLesson={setEditingLesson}
          />
        )}
      </section>

      <CourseFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        course={course}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: keys.adminCourse(id) })
          void queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] })
        }}
      />

      <LessonEditDialog
        lesson={editingLesson}
        onOpenChange={(open) => !open && setEditingLesson(null)}
      />
    </div>
  )
}
