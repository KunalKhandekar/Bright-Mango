import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BookOpen, Clock, PlayCircle } from 'lucide-react'
import { getCourseBySlug } from '@/api/courses'
import { listChapters } from '@/api/chapters'
import { listLessonsByCourse } from '@/api/lessons'
import { getMyEnrollmentForCourse } from '@/api/enrollments'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { PriceTag } from '@/components/shared/PriceTag'
import { formatDuration } from '@/lib/format'
import { keys } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth.store'
import { CurriculumAccordion } from '@/features/catalog/CurriculumAccordion'

export function CourseDetailPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const status = useAuthStore((s) => s.status)

  const courseQuery = useQuery({
    queryKey: keys.course(slug),
    queryFn: () => getCourseBySlug(slug),
  })
  const course = courseQuery.data?.course

  const chaptersQuery = useQuery({
    queryKey: keys.chapters(course?._id ?? ''),
    queryFn: () => listChapters(course!._id),
    enabled: !!course,
  })
  const lessonsQuery = useQuery({
    queryKey: keys.lessonsByCourse(course?._id ?? ''),
    queryFn: () => listLessonsByCourse(course!._id),
    enabled: !!course,
  })
  const accessQuery = useQuery({
    queryKey: keys.enrollmentAccess(course?._id ?? ''),
    queryFn: () => getMyEnrollmentForCourse(course!._id),
    enabled: !!course && status === 'authed',
  })

  if (courseQuery.isPending) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (!course) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Course not found"
        description="This course may have been unpublished or the link is incorrect."
        action={
          <Button asChild variant="outline">
            <Link to="/">Browse courses</Link>
          </Button>
        }
      />
    )
  }

  const lessons = lessonsQuery.data?.lessons ?? []
  const chapters = chaptersQuery.data?.chapters ?? []
  const hasAccess = accessQuery.data?.hasAccess ?? false
  const totalSeconds = lessons.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0)
  const firstLesson = lessons[0]

  const handleCta = () => {
    if (hasAccess) {
      navigate(
        firstLesson ? `/learn/${course._id}/lessons/${firstLesson._id}` : `/learn/${course._id}`,
      )
    } else if (status === 'authed') {
      navigate(`/checkout/${course.slug}`)
    } else {
      navigate(`/login?next=${encodeURIComponent(`/checkout/${course.slug}`)}`)
    }
  }

  const purchasePanel = (
    <Card>
      <CardContent className="space-y-4">
        {course.thumbnailUrl && (
          <img
            src={course.thumbnailUrl}
            alt=""
            className="aspect-video w-full rounded-lg object-cover"
          />
        )}
        <PriceTag price={course.price} className="text-2xl" />
        <Button className="w-full" size="lg" onClick={handleCta}>
          {hasAccess ? (
            <>
              <PlayCircle className="size-4" /> Continue learning
            </>
          ) : course.price === 0 ? (
            'Enroll for free'
          ) : (
            'Enroll now'
          )}
        </Button>
        <ul className="text-muted-foreground space-y-1.5 text-sm">
          <li className="flex items-center gap-2">
            <BookOpen className="size-4" /> {lessons.length}{' '}
            {lessons.length === 1 ? 'lesson' : 'lessons'} in {chapters.length}{' '}
            {chapters.length === 1 ? 'chapter' : 'chapters'}
          </li>
          {totalSeconds > 0 && (
            <li className="flex items-center gap-2">
              <Clock className="size-4" /> {formatDuration(totalSeconds)} of video
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight">{course.title}</h1>
            {course.shortDescription && (
              <p className="text-muted-foreground text-base">{course.shortDescription}</p>
            )}
          </div>

          {/* Mobile purchase panel */}
          <div className="lg:hidden">{purchasePanel}</div>

          {course.description && (
            <section className="space-y-2">
              <h2 className="text-lg font-medium">About this course</h2>
              <p className="text-muted-foreground text-sm whitespace-pre-line">
                {course.description}
              </p>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-lg font-medium">Curriculum</h2>
            <CurriculumAccordion
              chapters={chapters}
              lessons={lessons}
              courseId={course._id}
              hasAccess={hasAccess}
            />
          </section>
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-20">{purchasePanel}</div>
        </div>
      </div>
    </div>
  )
}
