import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bug, Image } from 'lucide-react'
import { listBugReports } from '@/api/bug-reports'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import type {
  BugReport,
  BugReportCategory,
  BugReportSeverity,
  BugReportStatus,
} from '@/types/models'
import {
  BugReportStatusBadge,
  CATEGORY_LABELS,
  STATUS_LABELS,
} from '@/features/bug-reports/bug-report-meta'
import { BugReportDetailDialog } from './BugReportDetailDialog'

/** Select sentinel for "no filter" (Radix Select cannot hold an empty-string value). */
const ALL = '__all__'

const SEVERITY_BADGES: Record<BugReportSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export function BugReportsPage() {
  const [status, setStatus] = useState<string>('open')
  const [category, setCategory] = useState(ALL)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<BugReport | null>(null)

  const filters = {
    status: status === ALL ? undefined : (status as BugReportStatus),
    category: category === ALL ? undefined : (category as BugReportCategory),
  }

  const { data, isPending } = useQuery({
    queryKey: keys.adminBugReports({ ...filters, page }),
    queryFn: () => listBugReports({ ...filters, page }),
  })
  const reports = data?.reports ?? []
  const hasFilters = status !== 'open' || category !== ALL

  const resetPage = () => setPage(1)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bug reports"
        description="Problems reported by students from their dashboard."
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v)
            resetPage()
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v)
            resetPage()
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus('open')
              setCategory(ALL)
              resetPage()
            }}
          >
            Reset filters
          </Button>
        )}
      </div>

      {isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={Bug}
          title="No bug reports here"
          description={
            status === 'open' ? 'Nothing open right now — nice.' : 'Try changing the filters.'
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => {
                  const reporter = typeof report.userId === 'object' ? report.userId : null
                  return (
                    <TableRow
                      key={report._id}
                      className="cursor-pointer"
                      onClick={() => setSelected(report)}
                    >
                      <TableCell className="max-w-64">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-medium">{report.title}</span>
                          {report.screenshotKey && (
                            <Image className="text-muted-foreground size-3.5 shrink-0" />
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-48 truncate">
                        {reporter?.name || reporter?.email || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {CATEGORY_LABELS[report.category]}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={report.severity === 'high' ? 'destructive' : 'outline'}
                        >
                          {SEVERITY_BADGES[report.severity]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <BugReportStatusBadge status={report.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDateTime(report.createdAt)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          {data?.meta && <Paginator meta={data.meta} onPageChange={setPage} />}
        </>
      )}

      <BugReportDetailDialog
        report={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </div>
  )
}
