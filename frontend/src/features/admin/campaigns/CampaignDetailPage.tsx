import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getCampaign } from '@/api/campaigns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatDateTime } from '@/lib/format'
import { keys } from '@/lib/query-client'
import { CAMPAIGN_STATUS_VARIANT } from '@/features/admin/campaigns/CampaignsPage'

export function CampaignDetailPage() {
  const { id = '' } = useParams()

  const { data, isPending } = useQuery({
    queryKey: keys.campaign(id),
    queryFn: () => getCampaign(id),
    refetchInterval: (query) =>
      query.state.data?.campaign.status !== 'completed' ? 4_000 : false,
  })
  const campaign = data?.campaign

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-56 w-full" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <EmptyState
        title="Campaign not found"
        action={
          <Button asChild variant="outline">
            <Link to="/admin/campaigns">Back to campaigns</Link>
          </Button>
        }
      />
    )
  }

  const percent =
    campaign.totalRecipients > 0 ? (campaign.sentCount / campaign.totalRecipients) * 100 : 0

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/admin/campaigns">
          <ArrowLeft className="size-4" /> Campaigns
        </Link>
      </Button>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{campaign.subject}</h1>
        <Badge variant={CAMPAIGN_STATUS_VARIANT[campaign.status]}>{campaign.status}</Badge>
      </div>
      <p className="text-muted-foreground -mt-4 text-sm">
        Created {formatDateTime(campaign.createdAt)}
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={percent} />
          <p className="text-muted-foreground text-sm">
            {campaign.sentCount} of {campaign.totalRecipients} emails sent
            {campaign.status !== 'completed' ? ' — updating live…' : ''}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Message</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-line">{campaign.body}</p>
        </CardContent>
      </Card>
    </div>
  )
}
