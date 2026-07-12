import { api, unwrap } from '@/lib/axios'
import type {
  BugReport,
  BugReportCategory,
  BugReportSeverity,
  BugReportStatus,
} from '@/types/models'

export function createScreenshotUploadUrl(input: { fileName: string; contentType: string }) {
  return unwrap<{ uploadUrl: string; fileKey: string }>(
    api.post('/bug-reports/screenshot-upload-url', input),
  )
}

export function createBugReport(input: {
  title: string
  description: string
  category: BugReportCategory
  severity?: BugReportSeverity
  pageUrl?: string
  screenshotKey?: string | null
}) {
  return unwrap<{ report: BugReport }>(api.post('/bug-reports', input))
}

export function listMyBugReports() {
  return unwrap<{ reports: BugReport[] }>(api.get('/bug-reports/mine'))
}

export function getBugReportScreenshotUrl(id: string) {
  return unwrap<{ url: string }>(api.get(`/bug-reports/${id}/screenshot`))
}

// ── Admin ───────────────────────────────────────────────────────────────────

export function listBugReports(
  params: {
    status?: BugReportStatus
    category?: BugReportCategory
    severity?: BugReportSeverity
    page?: number
    limit?: number
  } = {},
) {
  return unwrap<{ reports: BugReport[] }>(api.get('/bug-reports', { params }))
}

export function getOpenBugReportCount() {
  return unwrap<{ count: number }>(api.get('/bug-reports/open-count'))
}

export function updateBugReport(
  id: string,
  input: { status?: BugReportStatus; adminNote?: string },
) {
  return unwrap<{ report: BugReport }>(api.patch(`/bug-reports/${id}`, input))
}
