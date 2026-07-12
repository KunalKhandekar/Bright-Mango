import { Request, Response } from 'express';
import { ApiResponse } from '../../common/http/ApiResponse.js';
import { PERMISSIONS, roleHasPermission } from '../../common/constants/permissions.js';
import { getPagination, buildPaginationMeta } from '../../common/utils/pagination.util.js';
import * as bugReportService from './bugReport.service.js';
import {
  BUG_REPORT_CATEGORIES,
  BUG_REPORT_SEVERITIES,
  BUG_REPORT_STATUSES,
  BugReportCategory,
  BugReportSeverity,
  BugReportStatus,
} from './bugReport.model.js';

export async function screenshotUploadUrl(req: Request, res: Response): Promise<Response> {
  const data = await bugReportService.createScreenshotUploadUrl(req.auth!.userId, req.body);
  return ApiResponse.ok(res, 'Upload URL issued', data);
}

export async function create(req: Request, res: Response): Promise<Response> {
  const report = await bugReportService.createBugReport(req.auth!.userId, {
    ...req.body,
    userAgent: req.headers['user-agent'] ?? '',
  });
  return ApiResponse.created(res, 'Bug report submitted', { report });
}

export async function list(req: Request, res: Response): Promise<Response> {
  const pagination = getPagination(req);
  const { items, total } = await bugReportService.listBugReports(
    {
      status: typeof req.query.status === 'string' ? (req.query.status as BugReportStatus) : undefined,
      category: typeof req.query.category === 'string' ? (req.query.category as BugReportCategory) : undefined,
      severity: typeof req.query.severity === 'string' ? (req.query.severity as BugReportSeverity) : undefined,
    },
    pagination,
  );
  return ApiResponse.ok(res, 'Bug reports', { reports: items }, buildPaginationMeta(total, pagination));
}

export async function mine(req: Request, res: Response): Promise<Response> {
  const reports = await bugReportService.listMyBugReports(req.auth!.userId);
  return ApiResponse.ok(res, 'Your bug reports', { reports });
}

export async function openCount(_req: Request, res: Response): Promise<Response> {
  const count = await bugReportService.countOpenBugReports();
  return ApiResponse.ok(res, 'Open bug report count', { count });
}

export async function update(req: Request, res: Response): Promise<Response> {
  const report = await bugReportService.updateBugReport(req.params.id, req.auth!.userId, req.body);
  return ApiResponse.ok(res, 'Bug report updated', { report });
}

export async function screenshot(req: Request, res: Response): Promise<Response> {
  const data = await bugReportService.getScreenshotUrl(req.params.id, {
    userId: req.auth!.userId,
    canManage: roleHasPermission(req.auth!.role, PERMISSIONS.BUG_REPORT_MANAGE),
  });
  return ApiResponse.ok(res, 'Screenshot URL', data);
}

export async function filterOptions(_req: Request, res: Response): Promise<Response> {
  return ApiResponse.ok(res, 'Bug report filter options', {
    statuses: BUG_REPORT_STATUSES,
    categories: BUG_REPORT_CATEGORIES,
    severities: BUG_REPORT_SEVERITIES,
  });
}
