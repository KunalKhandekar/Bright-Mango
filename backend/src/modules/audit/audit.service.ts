import { Types } from 'mongoose';
import { AuditLog } from './auditLog.model.js';
import { AuditAction } from './audit.constants.js';
import { logger } from '../../common/utils/logger.js';
import { getPagination, buildPaginationMeta, PaginationParams } from '../../common/utils/pagination.util.js';

export interface AuditEntry {
  userId: string | Types.ObjectId;
  action: AuditAction;
  entityType: string;
  entityId?: string | Types.ObjectId;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget audit write. Never throws into the caller's flow — a failed audit
 * insert must not break the business action it records (it is logged instead).
 */
export function auditLog(entry: AuditEntry): void {
  AuditLog.create({
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadata: entry.metadata ?? {},
  }).catch((err) => logger.error({ err, entry }, '[audit] failed to write audit log'));
}

export interface AuditQuery {
  action?: string;
  entityType?: string;
  from?: Date;
  to?: Date;
}

export async function listAuditLogs(
  filter: AuditQuery,
  pagination: PaginationParams,
): Promise<{ items: unknown[]; total: number }> {
  const query: Record<string, unknown> = {};
  if (filter.action) query.action = filter.action;
  if (filter.entityType) query.entityType = filter.entityType;
  if (filter.from || filter.to) {
    query.createdAt = {
      ...(filter.from && { $gte: filter.from }),
      ...(filter.to && { $lte: filter.to }),
    };
  }

  const [items, total] = await Promise.all([
    AuditLog.find(query).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    AuditLog.countDocuments(query),
  ]);
  return { items, total };
}

export { getPagination, buildPaginationMeta };
