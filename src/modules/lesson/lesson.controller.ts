import { Request, Response } from 'express';
import { ApiResponse } from '../../common/http/ApiResponse.js';
import * as lessonService from './lesson.service.js';

export async function create(req: Request, res: Response): Promise<Response> {
  const lesson = await lessonService.createLesson(req.params.chapterId, req.auth!.userId, req.body);
  return ApiResponse.created(res, 'Lesson created', { lesson });
}

export async function uploadUrl(req: Request, res: Response): Promise<Response> {
  const data = await lessonService.createUploadUrl(req.params.id, req.auth!.userId);
  return ApiResponse.ok(res, 'Upload URL issued', data);
}

export async function update(req: Request, res: Response): Promise<Response> {
  const lesson = await lessonService.updateLesson(req.params.id, req.auth!.userId, req.body);
  return ApiResponse.ok(res, 'Lesson updated', { lesson });
}

export async function remove(req: Request, res: Response): Promise<Response> {
  await lessonService.deleteLesson(req.params.id, req.auth!.userId);
  return ApiResponse.ok(res, 'Lesson deleted');
}

export async function reorder(req: Request, res: Response): Promise<Response> {
  await lessonService.reorderLessons(req.params.chapterId, req.auth!.userId, req.body.orderedIds);
  return ApiResponse.ok(res, 'Lessons reordered');
}

export async function playback(req: Request, res: Response): Promise<Response> {
  const data = await lessonService.getPlayback(req.params.id);
  return ApiResponse.ok(res, 'Playback token', data);
}
