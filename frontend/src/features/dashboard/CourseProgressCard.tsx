import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ImageIcon } from 'lucide-react'
import { getCourseProgress } from '@/api/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { keys } from '@/lib/query-client'
import type { Enrollment } from '@/types/models'
import { refId } from '@/types/models'

export function CourseProgressCard({ enrollment }: { enrollment: Enrollment }) {
  const course = typeof enrollment.courseId === 'object' ? enrollment.courseId : null
  const courseId = refId(enrollment.courseId)

  const { data: progress } = useQuery({
    queryKey: keys.courseProgress(courseId),
    queryFn: () => getCourseProgress(courseId),
  })

  return (
    <Link to={`/learn/${courseId}`} className="group">
      <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow group-hover:shadow-md">
        <div className="bg-muted aspect-video w-full overflow-hidden">
          {course?.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <ImageIcon className="text-muted-foreground/40 size-8" />
            </div>
          )}
        </div>
        <CardContent className="space-y-3 p-4">
          <h3 className="line-clamp-2 font-medium leading-snug">
            {course?.title ?? 'Course'}
          </h3>
          {progress && progress.totalLessons > 0 ? (
            <div className="space-y-1.5">
              <Progress value={progress.percentage} />
              <p className="text-muted-foreground text-xs">
                {progress.completedLessons}/{progress.totalLessons} lessons ·{' '}
                {Math.round(progress.percentage)}% complete
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">Start learning</p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
