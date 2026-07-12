import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type {
  BugReportCategory,
  BugReportSeverity,
  BugReportStatus,
} from '@/types/models'

export const STATUS_LABELS: Record<BugReportStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
}

export const CATEGORY_LABELS: Record<BugReportCategory, string> = {
  playback: 'Video playback',
  payment: 'Payment',
  content: 'Course content',
  account: 'Account',
  other: 'Other',
}

export const SEVERITY_LABELS: Record<BugReportSeverity, string> = {
  low: 'Low — minor annoyance',
  medium: 'Medium — something is broken',
  high: 'High — I am blocked',
}

const STATUS_CLASSES: Record<BugReportStatus, string> = {
  open: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  in_progress: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  resolved: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  dismissed: 'bg-muted text-muted-foreground',
}

export function BugReportStatusBadge({ status }: { status: BugReportStatus }) {
  return <Badge className={cn(STATUS_CLASSES[status])}>{STATUS_LABELS[status]}</Badge>
}
