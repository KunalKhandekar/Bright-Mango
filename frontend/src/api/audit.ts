import { api, unwrap } from '@/lib/axios'
import type { AuditLog } from '@/types/models'

export function listAuditLogs(
  params: {
    action?: string
    entityType?: string
    from?: string
    to?: string
    page?: number
    limit?: number
  } = {},
) {
  return unwrap<{ logs: AuditLog[] }>(api.get('/audit-logs', { params }))
}

export function getAuditFilterOptions() {
  return unwrap<{ actions: string[]; entityTypes: string[] }>(api.get('/audit-logs/actions'))
}
