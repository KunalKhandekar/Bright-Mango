import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import { getAuditFilterOptions, listAuditLogs } from '@/api/audit'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { formatDateTime } from '@/lib/format'
import { keys } from '@/lib/query-client'

/** Select sentinel for "no filter" (Radix Select cannot hold an empty-string value). */
const ALL = '__all__'

export function AuditLogsPage() {
  const [action, setAction] = useState(ALL)
  const [entityType, setEntityType] = useState(ALL)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)

  const optionsQuery = useQuery({
    queryKey: keys.auditFilterOptions,
    queryFn: getAuditFilterOptions,
    staleTime: Infinity,
  })

  const filters = {
    action: action === ALL ? undefined : action,
    entityType: entityType === ALL ? undefined : entityType,
    from: fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : undefined,
    to: toDate ? new Date(`${toDate}T23:59:59.999`).toISOString() : undefined,
  }

  const { data, isPending } = useQuery({
    queryKey: keys.auditLogs({ ...filters, page }),
    queryFn: () => listAuditLogs({ ...filters, page }),
  })
  const logs = data?.logs ?? []
  const hasFilters = action !== ALL || entityType !== ALL || Boolean(fromDate) || Boolean(toDate)

  const resetPage = () => setPage(1)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Every sensitive admin action, recorded permanently."
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          value={action}
          onValueChange={(v) => {
            setAction(v)
            resetPage()
          }}
        >
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All actions</SelectItem>
            {(optionsQuery.data?.actions ?? []).map((a) => (
              <SelectItem key={a} value={a} className="font-mono text-xs">
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={entityType}
          onValueChange={(v) => {
            setEntityType(v)
            resetPage()
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Entity type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All entities</SelectItem>
            {(optionsQuery.data?.entityTypes ?? []).map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => {
              setFromDate(e.target.value)
              resetPage()
            }}
            className="w-full sm:w-40"
            aria-label="From date"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <Input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => {
              setToDate(e.target.value)
              resetPage()
            }}
            className="w-full sm:w-40"
            aria-label="To date"
          />
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAction(ALL)
              setEntityType(ALL)
              setFromDate('')
              setToDate('')
              resetPage()
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No matching audit entries"
          description={hasFilters ? 'Try removing the filters.' : undefined}
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
