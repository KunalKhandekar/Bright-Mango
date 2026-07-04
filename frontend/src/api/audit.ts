import { api, unwrap } from '@/lib/axios'
import type { AuditLog } from '@/types/models'

export function listAuditLogs(
  params: { action?: string; entityType?: string; page?: number; limit?: number } = {},
) {
  return unwrap<{ logs: AuditLog[] }>(api.get('/audit-logs', { params }))
}
