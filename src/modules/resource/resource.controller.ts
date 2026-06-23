import { Request, Response } from 'express';
import { ApiResponse } from '../../common/http/ApiResponse.js';
import * as resourceService from './resource.service.js';

export async function uploadUrl(req: Request, res: Response): Promise<Response> {
  const data = await resourceService.createUploadUrl(req.params.lessonId, req.auth!.userId, req.body);
  return ApiResponse.ok(res, 'Upload URL issued', data);
}

export async function create(req: Request, res: Response): Promise<Response> {
  const resource = await resourceService.createResource(req.params.lessonId, req.auth!.userId, req.body);
  return ApiResponse.created(res, 'Resource added', { resource });
}

export async function remove(req: Request, res: Response): Promise<Response> {
  await resourceService.deleteResource(req.params.id, req.auth!.userId);
  return ApiResponse.ok(res, 'Resource deleted');
}

export async function list(req: Request, res: Response): Promise<Response> {
  const resources = await resourceService.listResources(req.params.lessonId);
  return ApiResponse.ok(res, 'Resources', { resources });
}

export async function download(req: Request, res: Response): Promise<Response> {
  const data = await resourceService.getDownloadUrl(req.params.id);
  return ApiResponse.ok(res, 'Download URL', data);
}
