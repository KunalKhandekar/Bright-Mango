import { useQuery } from '@tanstack/react-query'
import { getRevenueByCourse } from '@/api/payments'
import { getEnrollmentStats } from '@/api/enrollments'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { QueryErrorState } from '@/components/shared/QueryErrorState'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatPrice } from '@/lib/format'
import { keys } from '@/lib/query-client'
import type { IsoDateRange } from '@/features/admin/shared/chart'

const TOP_N = 5

function BarRow({
  title,
  valueLabel,
  ratio,
  colorVar,
}: {
  title: string
  valueLabel: string
  ratio: number
  colorVar: string
}) {
  return (
    <li className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-medium">{title}</span>
        <span className="text-muted-foreground shrink-0 text-sm tabular-nums">{valueLabel}</span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(ratio * 100, 2)}%`, backgroundColor: `var(${colorVar})` }}
        />
      </div>
    </li>
  )
}

function RowsSkeleton() {
  return (
    <div className="space-y-4 pt-1">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  )
}

export function TopCoursesCard({ range }: { range: IsoDateRange }) {
  const revenueQuery = useQuery({
    queryKey: keys.adminRevenueByCourse(range),
    queryFn: () => getRevenueByCourse(range),
  })
  const enrollmentsQuery = useQuery({
    queryKey: keys.adminEnrollmentStats,
    queryFn: getEnrollmentStats,
  })

  const topRevenue = (revenueQuery.data?.courses ?? []).slice(0, TOP_N)
  const maxRevenue = topRevenue[0]?.netRevenue ?? 0
  const topEnrolled = [...(enrollmentsQuery.data?.byCourse ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N)
  const maxEnrolled = topEnrolled[0]?.count ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top courses</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="revenue">
          <TabsList>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
          </TabsList>
          <TabsContent value="revenue" className="pt-3">
            {revenueQuery.isPending ? (
              <RowsSkeleton />
            ) : revenueQuery.isError ? (
              <QueryErrorState
                message="Couldn't load revenue."
                onRetry={() => void revenueQuery.refetch()}
              />
            ) : topRevenue.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No paid orders in this period.
              </p>
            ) : (
              <ul className="space-y-4">
                {topRevenue.map((course) => (
                  <BarRow
                    key={course.courseId}
                    title={course.title}
                    valueLabel={formatPrice(course.netRevenue)}
                    ratio={maxRevenue > 0 ? course.netRevenue / maxRevenue : 0}
                    colorVar="--chart-1"
                  />
                ))}
              </ul>
            )}
          </TabsContent>
          <TabsContent value="enrollments" className="pt-3">
            {enrollmentsQuery.isPending ? (
              <RowsSkeleton />
            ) : enrollmentsQuery.isError ? (
              <QueryErrorState
                message="Couldn't load enrollments."
                onRetry={() => void enrollmentsQuery.refetch()}
              />
            ) : topEnrolled.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">No enrollments yet.</p>
            ) : (
              <>
                <ul className="space-y-4">
                  {topEnrolled.map((course) => (
                    <BarRow
                      key={course.courseId}
                      title={course.title}
                      valueLabel={`${course.count} student${course.count === 1 ? '' : 's'}`}
                      ratio={maxEnrolled > 0 ? course.count / maxEnrolled : 0}
                      colorVar="--chart-2"
                    />
                  ))}
                </ul>
                <p className="text-muted-foreground/70 mt-4 text-xs">All time</p>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
