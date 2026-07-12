import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GraduationCap } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getEnrollmentTimeseries } from '@/api/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { QueryErrorState } from '@/components/shared/QueryErrorState'
import { keys } from '@/lib/query-client'
import {
  bucketLabel,
  ChartTooltipFrame,
  fillBuckets,
  type ChartInterval,
  type IsoDateRange,
} from '@/features/admin/shared/chart'

export function EnrollmentTrendCard({
  range,
  interval,
}: {
  range: IsoDateRange
  interval: ChartInterval
}) {
  const seriesQuery = useQuery({
    queryKey: keys.adminEnrollmentSeries(range, interval),
    queryFn: () => getEnrollmentTimeseries({ ...range, interval }),
  })

  const chartData = useMemo(() => {
    if (!seriesQuery.data) return []
    return fillBuckets(
      seriesQuery.data.points,
      new Date(range.from),
      new Date(range.to),
      interval,
      (date) => ({ date, enrollments: 0 }),
    ).map((p) => ({ ...p, label: bucketLabel(p.date, interval) }))
  }, [seriesQuery.data, range, interval])
  const hasEnrollments = chartData.some((p) => p.enrollments > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New enrollments</CardTitle>
      </CardHeader>
      <CardContent>
        {seriesQuery.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : seriesQuery.isError ? (
          <QueryErrorState
            message="Couldn't load enrollments."
            onRetry={() => void seriesQuery.refetch()}
          />
        ) : !hasEnrollments ? (
          <EmptyState
            icon={GraduationCap}
            title="No new enrollments in this period"
            description="Enrollments will show up here as students join your courses."
          />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="enrollmentFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  interval="preserveStartEnd"
                  minTickGap={32}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  allowDecimals={false}
                  width={32}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--border)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const point = payload[0].payload as (typeof chartData)[number]
                    return (
                      <ChartTooltipFrame>
                        <p className="font-medium">{point.label}</p>
                        <p>
                          {point.enrollments} enrollment{point.enrollments === 1 ? '' : 's'}
                        </p>
                      </ChartTooltipFrame>
                    )
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="enrollments"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  fill="url(#enrollmentFill)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
