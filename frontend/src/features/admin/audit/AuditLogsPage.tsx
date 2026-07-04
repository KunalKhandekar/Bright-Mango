import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import { listAuditLogs } from '@/api/audit'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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

export function AuditLogsPage() {
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')
  const [page, setPage] = useState(1)

  const { data, isPending } = useQuery({
    queryKey: keys.auditLogs({ action: action || undefined, entityType: entityType || undefined, page }),
    queryFn: () =>
      listAuditLogs({
        action: action || undefined,
        entityType: entityType || undefined,
        page,
      }),
  })
  const logs = data?.logs ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Every sensitive action, recorded permanently."
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Filter by action (e.g. EMAIL_BLACKLISTED)"
          value={action}
          onChange={(e) => {
            setAction(e.target.value.toUpperCase())
            setPage(1)
          }}
          className="max-w-xs font-mono text-sm"
        />
        <Input
          placeholder="Filter by entity type (e.g. Course)"
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value)
            setPage(1)
          }}
          className="max-w-xs text-sm"
        />
      </div>

      {isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No matching audit entries"
          description={action || entityType ? 'Try removing the filters.' : undefined}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log._id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.entityType ?? '—'}
                    </TableCell>
                    <TableCell className="max-w-72">
                      <span className="text-muted-foreground block truncate font-mono text-xs">
                        {log.metadata ? JSON.stringify(log.metadata) : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
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
