import { Request, Response } from 'express';
import { ApiResponse } from '../../common/http/ApiResponse.js';
import { getPagination, buildPaginationMeta } from '../../common/utils/pagination.util.js';
import { listAuditLogs } from './audit.service.js';

export async function list(req: Request, res: Response): Promise<Response> {
  const pagination = getPagination(req);
  const { items, total } = await listAuditLogs(
    {
      action: typeof req.query.action === 'string' ? req.query.action : undefined,
      entityType: typeof req.query.entityType === 'string' ? req.query.entityType : undefined,
    },
    pagination,
  );
  return ApiResponse.ok(res, 'Audit logs', { logs: items }, buildPaginationMeta(total, pagination));
}
