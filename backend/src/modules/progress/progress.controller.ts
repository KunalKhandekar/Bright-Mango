import { Request, Response } from 'express';
import { ApiResponse } from '../../common/http/ApiResponse.js';
import * as progressService from './progress.service.js';

export async function record(req: Request, res: Response): Promise<Response> {
  const progress = await progressService.recordProgress(req.auth!.userId, req.params.lessonId, {
    deltaSeconds: Number(req.body.deltaSeconds),
    positionSeconds: Number(req.body.positionSeconds),
  });
  return ApiResponse.ok(res, 'Progress saved', { progress });
}

export async function courseProgress(req: Request, res: Response): Promise<Response> {
  const progress = await progressService.getCourseProgress(req.auth!.userId, req.params.courseId);
  return ApiResponse.ok(res, 'Course progress', progress);
}

export async function recent(req: Request, res: Response): Promise<Response> {
  const lessons = await progressService.getRecentlyWatched(req.auth!.userId);
  return ApiResponse.ok(res, 'Recently watched', { lessons });
}
