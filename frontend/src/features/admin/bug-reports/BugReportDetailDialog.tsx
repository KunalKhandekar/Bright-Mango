import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getBugReportScreenshotUrl, updateBugReport } from '@/api/bug-reports'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { errorMessage } from '@/lib/error-messages'
import { formatDateTime } from '@/lib/format'
import { keys } from '@/lib/query-client'
import type { BugReport, BugReportStatus } from '@/types/models'
import {
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
} from '@/features/bug-reports/bug-report-meta'

interface BugReportDetailDialogProps {
  report: BugReport | null
  onOpenChange: (open: boolean) => void
}

export function BugReportDetailDialog({ report, onOpenChange }: BugReportDetailDialogProps) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<BugReportStatus>('open')
  const [adminNote, setAdminNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!report) return
    setStatus(report.status)
    setAdminNote(report.adminNote ?? '')
  }, [report])

  const screenshotQuery = useQuery({
    queryKey: keys.bugReportScreenshot(report?._id ?? ''),
    queryFn: () => getBugReportScreenshotUrl(report!._id),
    enabled: Boolean(report?.screenshotKey),
    // Presigned URLs expire after a few minutes — don't serve a stale one.
    staleTime: 0,
    gcTime: 0,
  })

  const reporter = report && typeof report.userId === 'object' ? report.userId : null

  const handleSave = async () => {
    if (!report) return
    setSaving(true)
    try {
      await updateBugReport(report._id, { status, adminNote })
      toast.success('Bug report updated')
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'bug-reports'] })
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={Boolean(report)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        {report && (
          <>
            <DialogHeader>
              <DialogTitle>{report.title}</DialogTitle>
              <DialogDescription>
                {CATEGORY_LABELS[report.category]} · {SEVERITY_LABELS[report.severity]} ·{' '}
                {formatDateTime(report.createdAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <UserAvatar
                  name={reporter?.name}
                  email={reporter?.email}
                  avatar={reporter?.avatar}
                  className="size-8"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {reporter?.name || reporter?.email || 'Unknown user'}
                  </p>
                  {reporter?.email && (
                    <p className="text-muted-foreground truncate text-xs">{reporter.email}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label>Description</Label>
                <p className="text-sm whitespace-pre-wrap">{report.description}</p>
              </div>

              {(report.context?.pageUrl || report.context?.userAgent) && (
                <div className="space-y-1">
                  <Label>Captured context</Label>
                  {report.context.pageUrl && (
                    <p className="text-muted-foreground break-all font-mono text-xs">
                      {report.context.pageUrl}
                    </p>
                  )}
                  {report.context.userAgent && (
                    <p className="text-muted-foreground break-all font-mono text-xs">
                      {report.context.userAgent}
                    </p>
                  )}
                </div>
              )}

              {report.screenshotKey && (
                <div className="space-y-1">
                  <Label>Screenshot</Label>
                  {screenshotQuery.isPending ? (
                    <Skeleton className="aspect-video w-full rounded-md" />
                  ) : screenshotQuery.data ? (
                    <a href={screenshotQuery.data.url} target="_blank" rel="noreferrer">
                      <img
                        src={screenshotQuery.data.url}
                        alt="Bug report screenshot"
                        className="bg-muted w-full rounded-md border object-contain"
                      />
                    </a>
                  ) : (
                    <p className="text-muted-foreground text-sm">Couldn't load the screenshot.</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as BugReportStatus)}>
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bug-admin-note">Internal note</Label>
                <Textarea
                  id="bug-admin-note"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="Only visible to admins"
                />
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Save changes
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
