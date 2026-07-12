import { useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import { getEngagementStats } from '@/api/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { QueryErrorState } from '@/components/shared/QueryErrorState'
import { keys } from '@/lib/query-client'
import type { IsoDateRange } from '@/features/admin/shared/chart'

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  )
}

export function EngagementCard({
  range,
  rangeLabel,
}: {
  range: IsoDateRange
  rangeLabel: string
}) {
  const engagementQuery = useQuery({
    queryKey: keys.adminEngagement(range),
    queryFn: () => getEngagementStats(range),
  })
  const engagement = engagementQuery.data?.engagement

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Engagement</CardTitle>
      </CardHeader>
      <CardContent>
        {engagementQuery.isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !engagement ? (
          <QueryErrorState
            message="Couldn't load engagement."
            onRetry={() => void engagementQuery.refetch()}
          />
        ) : engagement.courses.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No courses yet"
            description="Engagement shows up here once students start watching lessons."
          />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Kpi
                label={`Active learners (${rangeLabel.toLowerCase()})`}
                value={String(engagement.activeLearners)}
              />
              <Kpi label="Avg completion" value={`${engagement.avgCompletionRate}%`} />
              <Kpi label="Lessons completed" value={String(engagement.lessonsCompleted)} />
            </div>
            <ul className="space-y-4">
              {engagement.courses.map((course) => (
                <li key={course.courseId} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium">{course.title}</span>
                    <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                      {course.completionRate === null ? '—' : `${course.completionRate}%`}
                    </span>
                  </div>
                  {course.completionRate !== null && (
                    <Progress value={course.completionRate} className="h-2" />
                  )}
                  <p className="text-muted-foreground/70 text-xs">
                    {course.activeStudents}/{course.enrolledStudents} students active
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
