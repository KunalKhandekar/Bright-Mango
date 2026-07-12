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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatPrice } from '@/lib/format'
import { keys } from '@/lib/query-client'
import type { IsoDateRange } from '@/features/admin/shared/chart'

/**
 * Uniform KPI card: icon tile | large metric / small label. Two rows in every
 * card — context that doesn't fit this hierarchy goes into `hint` (a hover
 * tooltip), never a third text line.
 */
function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  to,
}: {
  icon: LucideIcon
  label: string
  value: string | undefined
  hint?: string
  to: string
}) {
  const card = (
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
          </div>
        </CardContent>
      </Card>
    </Link>
  )

  if (!hint) return card
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function OverviewStatCards({
  range,
  rangeLabel,
  commentsTotal,
  commentsError,
}: {
  range: IsoDateRange
  rangeLabel: string
  commentsTotal: number | undefined
  commentsError: boolean
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
  // A failed query renders "—" — leaving value undefined would show a skeleton forever.
  const summaryStat = (v: number | undefined) =>
    summaryQuery.isError ? '—' : v === undefined ? undefined : String(v)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <StatCard
        icon={BookOpen}
        label="Courses"
        value={summaryStat(summary?.courses)}
        to="/admin/courses"
      />
      <StatCard
        icon={Users}
        label="Students"
        value={summaryStat(summary?.students)}
        to="/admin/students"
      />
      <StatCard
        icon={GraduationCap}
        label="Enrollments"
        value={summaryStat(summary?.enrollments)}
        to="/admin/enrollments"
      />
      <StatCard
        icon={IndianRupee}
        label="Net revenue"
        value={paymentsQuery.isError ? '—' : payments && formatPrice(payments.netRevenue)}
        hint={rangeLabel}
        to="/admin/payments"
      />
      <StatCard
        icon={MessageSquare}
        label="Comments"
        value={
          commentsError ? '—' : commentsTotal === undefined ? undefined : String(commentsTotal)
        }
        to="/admin/comments"
      />
    </div>
  )
}
