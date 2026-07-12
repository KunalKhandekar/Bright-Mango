import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { cancelCampaign, listCampaigns } from '@/api/campaigns'
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
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Paginator } from '@/components/shared/Paginator'
import { errorMessage } from '@/lib/error-messages'
import { formatDateTime } from '@/lib/format'
import { keys } from '@/lib/query-client'
import type { Campaign } from '@/types/models'

export const CAMPAIGN_STATUS_VARIANT: Record<
  Campaign['status'],
  'default' | 'secondary' | 'outline'
> = {
  completed: 'default',
  sending: 'secondary',
  scheduled: 'secondary',
  pending: 'outline',
  cancelled: 'outline',
}

/** Statuses that can still change without user action (worth polling for). */
const LIVE_STATUSES = new Set<Campaign['status']>(['pending', 'sending', 'scheduled'])

export function CampaignsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  const { data, isPending } = useQuery({
    queryKey: keys.campaigns(page),
    queryFn: () => listCampaigns({ page }),
    // Live-update while a campaign is being delivered or waiting to fire.
    refetchInterval: (query) =>
      query.state.data?.campaigns.some((c) => LIVE_STATUSES.has(c.status)) ? 5_000 : false,
  })
  const campaigns = data?.campaigns ?? []

  const cancel = useMutation({
    mutationFn: cancelCampaign,
    onSuccess: () => {
      toast.success('Campaign cancelled')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

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
                  <TableHead>Scheduled for</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12" />
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
                      {campaign.scheduledFor ? formatDateTime(campaign.scheduledFor) : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDateTime(campaign.createdAt)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {campaign.status === 'scheduled' && (
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="Cancel campaign">
                              <X className="size-4" />
                            </Button>
                          }
                          title="Cancel this scheduled campaign?"
                          description="It will not be sent. This cannot be undone."
                          confirmLabel="Cancel campaign"
                          destructive
                          onConfirm={async () => {
                            await cancel.mutateAsync(campaign._id)
                          }}
                        />
                      )}
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
