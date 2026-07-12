import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bug } from 'lucide-react'
import { listMyBugReports } from '@/api/bug-reports'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/format'
import { keys } from '@/lib/query-client'
import { BugReportStatusBadge, CATEGORY_LABELS } from './bug-report-meta'
import { ReportBugDialog } from './ReportBugDialog'

/** Dashboard section: report a bug + status of the user's past reports. */
export function MyBugReportsSection() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data } = useQuery({
    queryKey: keys.myBugReports,
    queryFn: listMyBugReports,
  })
  const reports = data?.reports ?? []

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-medium">
          <Bug className="size-4" /> Bug reports
        </h2>
        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          <Bug className="size-3.5" /> Report a bug
        </Button>
      </div>

      {reports.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Ran into a problem? Let us know and we'll look into it.
        </p>
      ) : (
        <ul className="space-y-2">
          {reports.map((report) => (
            <li
              key={report._id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{report.title}</p>
                <p className="text-muted-foreground text-xs">
                  {CATEGORY_LABELS[report.category]} · {formatRelativeTime(report.createdAt)}
                </p>
              </div>
              <BugReportStatusBadge status={report.status} />
            </li>
          ))}
        </ul>
      )}

      <ReportBugDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </section>
  )
}
