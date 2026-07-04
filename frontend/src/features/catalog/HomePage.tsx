import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { listPublishedCourses } from '@/api/courses'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { Paginator } from '@/components/shared/Paginator'
import { keys } from '@/lib/query-client'
import { CourseCard } from '@/features/catalog/CourseCard'

export function HomePage() {
  const [page, setPage] = useState(1)
  const { data, isPending } = useQuery({
    queryKey: keys.courses(page),
    queryFn: () => listPublishedCourses({ page }),
  })

  return (
    <div className="space-y-8">
      <section className="space-y-2 pt-4 text-center sm:pt-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Learn something new today
        </h1>
        <p className="text-muted-foreground mx-auto max-w-xl text-sm sm:text-base">
          Hands-on courses taught by your mentor — watch anywhere, learn at your own pace.
        </p>
      </section>

      {isPending ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-video w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      ) : !data || data.courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="New courses are on the way. Check back soon!"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.courses.map((course) => (
              <CourseCard key={course._id} course={course} />
            ))}
          </div>
          {data.meta && <Paginator meta={data.meta} onPageChange={setPage} />}
        </>
      )}
    </div>
  )
}
