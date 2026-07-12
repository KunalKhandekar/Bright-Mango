import crypto from 'node:crypto';
import { Types } from 'mongoose';
import {
  BugReport,
  BugReportDoc,
  BugReportCategory,
  BugReportSeverity,
  BugReportStatus,
} from './bugReport.model.js';
import * as r2 from '../../integrations/r2.service.js';
import { ApiError } from '../../common/http/ApiError.js';
import { auditLog } from '../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import { getPagination, buildPaginationMeta, PaginationParams } from '../../common/utils/pagination.util.js';

/**
 * Issue a presigned upload URL for a bug screenshot. The key is scoped to the
 * reporter (`bug-reports/<userId>/…`) so createBugReport can verify ownership.
 */
export async function createScreenshotUploadUrl(
  userId: string,
  input: { fileName: string; contentType: string },
): Promise<{ uploadUrl: string; fileKey: string }> {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileKey = `bug-reports/${userId}/${crypto.randomBytes(8).toString('hex')}-${safeName}`;
  const uploadUrl = await r2.getPresignedUploadUrl(fileKey, input.contentType);
  return { uploadUrl, fileKey };
}

export async function createBugReport(
  userId: string,
  input: {
    title: string;
    description: string;
    category: BugReportCategory;
    severity?: BugReportSeverity;
    pageUrl?: string;
    screenshotKey?: string | null;
    userAgent?: string;
  },
): Promise<BugReportDoc> {
  // A report may only reference a screenshot the same user uploaded.
  if (input.screenshotKey && !input.screenshotKey.startsWith(`bug-reports/${userId}/`)) {
    throw ApiError.forbidden('Screenshot does not belong to you');
  }

  const report = await BugReport.create({
    userId,
    title: input.title,
    description: input.description,
    category: input.category,
    severity: input.severity ?? 'medium',
    context: {
      pageUrl: input.pageUrl ?? '',
      userAgent: input.userAgent ?? '',
    },
    screenshotKey: input.screenshotKey ?? null,
  });
  return report.toObject() as BugReportDoc;
}

export interface BugReportQuery {
  status?: BugReportStatus;
  category?: BugReportCategory;
  severity?: BugReportSeverity;
}

export async function listBugReports(
  filter: BugReportQuery,
  pagination: PaginationParams,
): Promise<{ items: unknown[]; total: number }> {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.category) query.category = filter.category;
  if (filter.severity) query.severity = filter.severity;

  const [items, total] = await Promise.all([
    BugReport.find(query)
      .populate('userId', 'name email avatar')
      .populate('resolvedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    BugReport.countDocuments(query),
  ]);
  return { items, total };
}

export async function listMyBugReports(userId: string): Promise<BugReportDoc[]> {
  return BugReport.find({ userId })
    .select('-context -adminNote -resolvedBy')
    .sort({ createdAt: -1 })
    .lean<BugReportDoc[]>();
}

/** Count of open reports — drives the admin nav badge. */
export async function countOpenBugReports(): Promise<number> {
  return BugReport.countDocuments({ status: 'open' });
}

export async function updateBugReport(
  reportId: string,
  adminId: string,
  input: { status?: BugReportStatus; adminNote?: string },
): Promise<BugReportDoc> {
  const report = await BugReport.findById(reportId);
  if (!report) throw ApiError.notFound('Bug report not found');

  if (input.adminNote !== undefined) report.adminNote = input.adminNote;
  if (input.status && input.status !== report.status) {
    const previousStatus = report.status;
    report.status = input.status;
    if (input.status === 'resolved' || input.status === 'dismissed') {
      report.resolvedBy = new Types.ObjectId(adminId);
      report.resolvedAt = new Date();
    } else {
      report.resolvedBy = null;
      report.resolvedAt = null;
    }
    auditLog({
      userId: adminId,
      action: AUDIT_ACTIONS.BUG_REPORT_STATUS_CHANGED,
      entityType: 'BugReport',
      entityId: report._id,
      metadata: { from: previousStatus, to: input.status },
    });
  }

  await report.save();
  return report.toObject() as BugReportDoc;
}

/** Short-lived presigned URL for a report's screenshot — admin or the reporter only. */
export async function getScreenshotUrl(
  reportId: string,
  viewer: { userId: string; canManage: boolean },
): Promise<{ url: string }> {
  const report = await BugReport.findById(reportId).select('userId screenshotKey').lean<BugReportDoc>();
  if (!report) throw ApiError.notFound('Bug report not found');
  if (!viewer.canManage && report.userId.toString() !== viewer.userId) {
    throw ApiError.forbidden();
  }
  if (!report.screenshotKey) throw ApiError.notFound('This report has no screenshot');
  const url = await r2.getPresignedDownloadUrl(report.screenshotKey);
  return { url };
}

export { getPagination, buildPaginationMeta };
