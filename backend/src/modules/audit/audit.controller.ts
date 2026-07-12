import { Request, Response } from 'express';
import { ApiResponse } from '../../common/http/ApiResponse.js';
import { getPagination, buildPaginationMeta } from '../../common/utils/pagination.util.js';
import { listAuditLogs } from './audit.service.js';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from './audit.constants.js';

export async function list(req: Request, res: Response): Promise<Response> {
  const pagination = getPagination(req);
  const { items, total } = await listAuditLogs(
    {
      action: typeof req.query.action === 'string' ? req.query.action : undefined,
      entityType: typeof req.query.entityType === 'string' ? req.query.entityType : undefined,
      from: typeof req.query.from === 'string' ? new Date(req.query.from) : undefined,
      to: typeof req.query.to === 'string' ? new Date(req.query.to) : undefined,
    },
    pagination,
  );
  return ApiResponse.ok(res, 'Audit logs', { logs: items }, buildPaginationMeta(total, pagination));
}

export async function filterOptions(_req: Request, res: Response): Promise<Response> {
  return ApiResponse.ok(res, 'Audit filter options', {
    actions: Object.values(AUDIT_ACTIONS),
    entityTypes: AUDIT_ENTITY_TYPES,
  });
}
