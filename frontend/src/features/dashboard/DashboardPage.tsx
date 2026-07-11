import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BookOpen, History, PlayCircle } from 'lucide-react'
import { listMyEnrollments } from '@/api/enrollments'
import { getRecentlyWatched } from '@/api/progress'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Paginator } from '@/components/shared/Paginator'
import { formatRelativeTime } from '@/lib/format'
import { keys } from '@/lib/query-client'
import { refId } from '@/types/models'
import { useAuthStore } from '@/stores/auth.store'
import { CourseProgressCard } from '@/features/dashboard/CourseProgressCard'

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const [page, setPage] = useState(1)

  const enrollmentsQuery = useQuery({
    queryKey: keys.myEnrollments(page),
    queryFn: () => listMyEnrollments({ page }),
  })
  const recentQuery = useQuery({
    queryKey: keys.recentProgress,
    queryFn: getRecentlyWatched,
  })

  const enrollments = enrollmentsQuery.data?.enrollments ?? []
  // Continue watching surfaces only the single most-recently-watched lesson.
  const recent = (recentQuery.data?.lessons ?? []).slice(0, 1)

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        description="Pick up where you left off."
      />

      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-medium">
            <History className="size-4" /> Continue watching
          </h2>
          <ul className="space-y-2">
            {recent.map((item) => {
              const lesson = typeof item.lessonId === 'object' ? item.lessonId : null
              if (!lesson) return null
              return (
                <li key={item._id}>
                  <Link
                    to={`/learn/${item.courseId}/lessons/${lesson._id}`}
                    className="hover:bg-accent flex items-center gap-3 rounded-lg border p-3 transition-colors"
                  >
                    <PlayCircle className="text-primary size-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {lesson.title}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatRelativeTime(item.watchedAt)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-medium">
          <BookOpen className="size-4" /> My courses
        </h2>

        {enrollmentsQuery.isPending ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-xl" />
            ))}
          </div>
        ) : enrollments.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="You're not enrolled in any course yet"
            description="Browse the catalog and start learning today."
            action={
              <Button asChild>
                <Link to="/">Browse courses</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {enrollments.map((enrollment) => (
                <CourseProgressCard key={refId(enrollment.courseId)} enrollment={enrollment} />
              ))}
            </div>
            {enrollmentsQuery.data?.meta && (
              <Paginator meta={enrollmentsQuery.data.meta} onPageChange={setPage} />
            )}
          </>
        )}
      </section>
    </div>
  )
}
