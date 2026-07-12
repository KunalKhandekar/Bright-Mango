import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { IndianRupee, Receipt, TicketPercent, TrendingUp } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  getPaymentsSummary,
  getRevenueByCourse,
  getRevenueTimeseries,
  listAdminOrders,
} from '@/api/payments'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { formatDateTime, formatPrice } from '@/lib/format'
import { keys } from '@/lib/query-client'
import {
  bucketLabel,
  ChartTooltipFrame,
  fillBuckets,
  RangeSelect,
  useDateRange,
} from '@/features/admin/shared/chart'

const ORDER_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  paid: 'default',
  pending: 'secondary',
  failed: 'destructive',
}

/** Select sentinel for "any status". */
const ALL_STATUSES = '__all__'

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof IndianRupee
  label: string
  value: string | undefined
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className="bg-primary/10 flex size-11 items-center justify-center rounded-lg">
          <Icon className="text-primary size-5" />
        </div>
        <div>
          {value === undefined ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
          )}
          <p className="text-muted-foreground text-sm">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function PaymentsPage() {
  const [rangeKey, setRangeKey] = useState('30d')
  const [orderStatus, setOrderStatus] = useState(ALL_STATUSES)
  const [ordersPage, setOrdersPage] = useState(1)

  const { range, interval } = useDateRange(rangeKey)

  const summaryQuery = useQuery({
    queryKey: keys.adminPaymentsSummary(range),
    queryFn: () => getPaymentsSummary(range),
  })
  const seriesQuery = useQuery({
    queryKey: keys.adminRevenueSeries(range, interval),
    queryFn: () => getRevenueTimeseries({ ...range, interval }),
  })
  const byCourseQuery = useQuery({
    queryKey: keys.adminRevenueByCourse(range),
    queryFn: () => getRevenueByCourse(range),
  })
  const ordersQuery = useQuery({
    queryKey: keys.adminOrders({
      status: orderStatus === ALL_STATUSES ? undefined : orderStatus,
      page: ordersPage,
    }),
    queryFn: () =>
      listAdminOrders({
        status: orderStatus === ALL_STATUSES ? undefined : orderStatus,
        page: ordersPage,
      }),
  })

  const summary = summaryQuery.data?.summary
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
  const courses = byCourseQuery.data?.courses ?? []
  const orders = ordersQuery.data?.orders ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Income"
        description="What your courses earned — overall and per course."
        actions={<RangeSelect value={rangeKey} onValueChange={setRangeKey} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={IndianRupee}
          label="Net revenue"
          value={summary && formatPrice(summary.netRevenue)}
        />
        <StatCard
          icon={TrendingUp}
          label="Gross revenue"
          value={summary && formatPrice(summary.grossRevenue)}
        />
        <StatCard
          icon={TicketPercent}
          label="Discounts given"
          value={summary && formatPrice(summary.discountTotal)}
        />
        <StatCard
          icon={Receipt}
          label="Paid orders"
          value={summary && String(summary.paidOrders)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Net revenue over time</CardTitle>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Earnings by course</CardTitle>
          </CardHeader>
          <CardContent>
            {byCourseQuery.isPending ? (
              <Skeleton className="h-48 w-full" />
            ) : courses.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No paid orders in this period.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Net revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map((course) => (
                    <TableRow key={course.courseId}>
                      <TableCell className="max-w-48 truncate font-medium">
                        {course.title}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right">
                        {course.orders}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPrice(course.netRevenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Recent orders</CardTitle>
              <Select
                value={orderStatus}
                onValueChange={(v) => {
                  setOrderStatus(v)
                  setOrdersPage(1)
                }}
              >
                <SelectTrigger size="sm" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {ordersQuery.isPending ? (
              <Skeleton className="h-48 w-full" />
            ) : orders.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">No orders found.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order._id}>
                        <TableCell className="max-w-36 truncate">
                          {order.studentId?.name || order.studentId?.email || '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-36 truncate">
                          {order.courseId?.title ?? '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPrice(order.finalAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={ORDER_STATUS_VARIANT[order.status] ?? 'secondary'}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatDateTime(order.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {ordersQuery.data?.meta && (
                  <Paginator meta={ordersQuery.data.meta} onPageChange={setOrdersPage} />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
