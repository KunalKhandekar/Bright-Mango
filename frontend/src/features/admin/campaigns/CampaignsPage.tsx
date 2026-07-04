import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Plus } from 'lucide-react'
import { listCampaigns } from '@/api/campaigns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { formatDateTime } from '@/lib/format'
import { keys } from '@/lib/query-client'
import type { Campaign } from '@/types/models'

export const CAMPAIGN_STATUS_VARIANT: Record<
  Campaign['status'],
  'default' | 'secondary' | 'outline'
> = {
  completed: 'default',
  sending: 'secondary',
  pending: 'outline',
}

export function CampaignsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)

  const { data, isPending } = useQuery({
    queryKey: keys.campaigns(page),
    queryFn: () => listCampaigns({ page }),
    // Live-update while a campaign is being delivered.
    refetchInterval: (query) =>
      query.state.data?.campaigns.some((c) => c.status !== 'completed') ? 5_000 : false,
  })
  const campaigns = data?.campaigns ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email campaigns"
        description="Broadcast announcements to all your students."
        actions={
          <Button asChild>
            <Link to="/admin/campaigns/new">
              <Plus className="size-4" /> New campaign
            </Link>
          </Button>
        }
      />

      {isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No campaigns yet"
          description="Send your first announcement to every student."
          action={
            <Button asChild>
              <Link to="/admin/campaigns/new">
                <Plus className="size-4" /> New campaign
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow
                    key={campaign._id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/admin/campaigns/${campaign._id}`)}
                  >
                    <TableCell className="max-w-72 truncate font-medium">
                      {campaign.subject}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {campaign.sentCount}/{campaign.totalRecipients}
                    </TableCell>
                    <TableCell>
                      <Badge variant={CAMPAIGN_STATUS_VARIANT[campaign.status]}>
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDateTime(campaign.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {data?.meta && <Paginator meta={data.meta} onPageChange={setPage} />}
        </>
      )}
    </div>
  )
}
