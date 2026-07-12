import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, TrendingUp } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getRevenueTimeseries } from '@/api/payments'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatPrice } from '@/lib/format'
import { keys } from '@/lib/query-client'
import {
  bucketLabel,
  ChartTooltipFrame,
  fillBuckets,
  type ChartInterval,
  type IsoDateRange,
} from '@/features/admin/shared/chart'

export function RevenueTrendCard({
  range,
  interval,
}: {
  range: IsoDateRange
  interval: ChartInterval
}) {
  const seriesQuery = useQuery({
    queryKey: keys.adminRevenueSeries(range, interval),
    queryFn: () => getRevenueTimeseries({ ...range, interval }),
  })

  const chartData = useMemo(() => {
    if (!seriesQuery.data) return []
    return fillBuckets(
      seriesQuery.data.points,
      new Date(range.from),
      new Date(range.to),
      interval,
      (date) => ({ date, netRevenue: 0, orders: 0 }),
    ).map((p) => ({ ...p, label: bucketLabel(p.date, interval) }))
  }, [seriesQuery.data, range, interval])
  const hasRevenue = chartData.some((p) => p.netRevenue > 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Net revenue</CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/payments">
            View income <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {seriesQuery.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : !hasRevenue ? (
          <EmptyState
            icon={TrendingUp}
            title="No revenue in this period"
            description="Paid orders will show up here as they come in."
          />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
                  tickFormatter={(paise: number) => formatPrice(paise)}
                  width={80}
                />
                <Tooltip
                  cursor={{ fill: 'var(--accent)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const point = payload[0].payload as (typeof chartData)[number]
                    return (
                      <ChartTooltipFrame>
                        <p className="font-medium">{point.label}</p>
                        <p>{formatPrice(point.netRevenue)} net</p>
                      </ChartTooltipFrame>
                    )
                  }}
                />
                <Bar
                  dataKey="netRevenue"
                  fill="var(--chart-1)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
