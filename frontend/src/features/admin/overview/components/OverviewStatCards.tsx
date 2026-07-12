import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  GraduationCap,
  IndianRupee,
  MessageSquare,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { getDashboardSummary } from '@/api/dashboard'
import { getPaymentsSummary } from '@/api/payments'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice } from '@/lib/format'
import { keys } from '@/lib/query-client'
import type { IsoDateRange } from '@/features/admin/shared/chart'

/**
 * Uniform KPI card: icon tile | value / label / sublabel. The sublabel row is
 * always rendered (min-h reserves its line) so every card keeps the same
 * internal geometry whether or not it has helper text.
 */
function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  to,
}: {
  icon: LucideIcon
  label: string
  value: string | undefined
  sublabel?: string
  to: string
}) {
  return (
    <Link to={to}>
      <Card className="hover:bg-accent/40 h-full transition-colors">
        <CardContent className="flex h-full items-center gap-4">
          <div className="bg-primary/10 flex size-11 shrink-0 items-center justify-center rounded-lg">
            <Icon className="text-primary size-5" />
          </div>
          <div className="min-w-0 flex-1">
            {value === undefined ? (
              <Skeleton className="h-7 w-14" />
            ) : (
              <p className="truncate text-2xl leading-7 font-semibold tabular-nums">{value}</p>
            )}
            <p className="text-muted-foreground truncate text-sm leading-5">{label}</p>
            <p className="text-muted-foreground/70 min-h-4 truncate text-xs leading-4">
              {sublabel}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function OverviewStatCards({
  range,
  rangeLabel,
  commentsTotal,
}: {
  range: IsoDateRange
  rangeLabel: string
  commentsTotal: number | undefined
}) {
  const summaryQuery = useQuery({
    queryKey: keys.adminDashboardSummary,
    queryFn: getDashboardSummary,
  })
  const paymentsQuery = useQuery({
    queryKey: keys.adminPaymentsSummary(range),
    queryFn: () => getPaymentsSummary(range),
  })

  const summary = summaryQuery.data?.summary
  const payments = paymentsQuery.data?.summary

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <StatCard
        icon={BookOpen}
        label="Courses"
        value={summary && String(summary.courses)}
        sublabel={summary && `${summary.publishedCourses} published`}
        to="/admin/courses"
      />
      <StatCard
        icon={Users}
        label="Students"
        value={summary && String(summary.students)}
        to="/admin/students"
      />
      <StatCard
        icon={GraduationCap}
        label="Enrollments"
        value={summary && String(summary.enrollments)}
        sublabel={summary && `+${summary.newEnrollments30d} in last 30 days`}
        to="/admin/enrollments"
      />
      <StatCard
        icon={IndianRupee}
        label="Net revenue"
        value={payments && formatPrice(payments.netRevenue)}
        sublabel={rangeLabel}
        to="/admin/payments"
      />
      <StatCard
        icon={MessageSquare}
        label="Comments"
        value={commentsTotal === undefined ? undefined : String(commentsTotal)}
        to="/admin/comments"
      />
    </div>
  )
}
