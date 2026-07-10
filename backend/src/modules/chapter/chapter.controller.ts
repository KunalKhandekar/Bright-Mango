import { Request, Response } from 'express';
import { ApiResponse } from '../../common/http/ApiResponse.js';
import * as chapterService from './chapter.service.js';

export async function create(req: Request, res: Response): Promise<Response> {
  const chapter = await chapterService.createChapter(req.params.courseId, req.auth!.userId, req.body);
  return ApiResponse.created(res, 'Chapter created', { chapter });
}

export async function update(req: Request, res: Response): Promise<Response> {
  const chapter = await chapterService.updateChapter(req.params.id, req.auth!.userId, req.body);
  return ApiResponse.ok(res, 'Chapter updated', { chapter });
}

export async function remove(req: Request, res: Response): Promise<Response> {
  await chapterService.deleteChapter(req.params.id, req.auth!.userId);
  return ApiResponse.ok(res, 'Chapter deleted');
}

export async function list(req: Request, res: Response): Promise<Response> {
  const chapters = await chapterService.listChapters(req.params.courseId);
  return ApiResponse.ok(res, 'Chapters', { chapters });
}

export async function reorder(req: Request, res: Response): Promise<Response> {
  await chapterService.reorderChapters(req.params.courseId, req.auth!.userId, req.body.orderedIds);
  return ApiResponse.ok(res, 'Chapters reordered');
}
