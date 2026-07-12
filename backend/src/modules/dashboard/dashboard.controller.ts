import { Request, Response } from 'express';
import { ApiResponse } from '../../common/http/ApiResponse.js';
import { parseRange } from '../../common/utils/dateRange.util.js';
import * as dashboardService from './dashboard.service.js';

export async function summary(req: Request, res: Response): Promise<Response> {
  const summary = await dashboardService.getDashboardSummary(req.auth!.userId);
  return ApiResponse.ok(res, 'Dashboard summary', { summary });
}

export async function enrollmentTimeseries(req: Request, res: Response): Promise<Response> {
  const interval = req.query.interval === 'month' ? 'month' : 'day';
  const points = await dashboardService.getEnrollmentTimeseries(
    req.auth!.userId,
    parseRange(req),
    interval,
  );
  return ApiResponse.ok(res, 'Enrollments over time', { points, interval });
}

export async function engagement(req: Request, res: Response): Promise<Response> {
  const engagement = await dashboardService.getEngagementStats(req.auth!.userId, parseRange(req));
  return ApiResponse.ok(res, 'Engagement stats', { engagement });
}
