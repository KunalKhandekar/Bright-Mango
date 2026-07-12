import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listRecentComments } from '@/api/comments'
import { PageHeader } from '@/components/shared/PageHeader'
import { keys } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth.store'
import { RangeSelect, useDateRange } from '@/features/admin/shared/chart'
import { EngagementCard } from './components/EngagementCard'
import { EnrollmentTrendCard } from './components/EnrollmentTrendCard'
import { LatestCommentsCard } from './components/LatestCommentsCard'
import { OverviewStatCards } from './components/OverviewStatCards'
import { RevenueTrendCard } from './components/RevenueTrendCard'
import { TopCoursesCard } from './components/TopCoursesCard'

export function AdminDashboardPage() {
  const user = useAuthStore((s) => s.user)
  const [rangeKey, setRangeKey] = useState('30d')
  const { range, interval, label: rangeLabel } = useDateRange(rangeKey)

  const commentsQuery = useQuery({
    queryKey: keys.adminOverviewComments,
    queryFn: () => listRecentComments({ limit: 5 }),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello${user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋`}
        description="Here's what's happening on your platform."
        actions={<RangeSelect value={rangeKey} onValueChange={setRangeKey} />}
      />

      <OverviewStatCards
        range={range}
        rangeLabel={rangeLabel}
        commentsTotal={commentsQuery.data?.meta?.total}
        commentsError={commentsQuery.isError}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueTrendCard range={range} interval={interval} />
        <EnrollmentTrendCard range={range} interval={interval} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TopCoursesCard range={range} />
        <EngagementCard range={range} rangeLabel={rangeLabel} />
      </div>

      <LatestCommentsCard
        comments={commentsQuery.data?.comments ?? []}
        isPending={commentsQuery.isPending}
        isError={commentsQuery.isError}
        onRetry={() => void commentsQuery.refetch()}
      />
    </div>
  )
}
