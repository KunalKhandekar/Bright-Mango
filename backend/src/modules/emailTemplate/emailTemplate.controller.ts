import { Request, Response } from 'express';
import { ApiResponse } from '../../common/http/ApiResponse.js';
import { getPagination, buildPaginationMeta } from '../../common/utils/pagination.util.js';
import * as templateService from './emailTemplate.service.js';
import { EmailProcessKey } from './emailTemplate.constants.js';

export async function list(req: Request, res: Response): Promise<Response> {
  const pagination = getPagination(req);
  const { items, total } = await templateService.listTemplates(pagination);
  return ApiResponse.ok(res, 'Email templates', { templates: items }, buildPaginationMeta(total, pagination));
}

export async function get(req: Request, res: Response): Promise<Response> {
  const template = await templateService.getTemplate(req.params.id);
  return ApiResponse.ok(res, 'Email template', { template });
}

export async function create(req: Request, res: Response): Promise<Response> {
  const template = await templateService.createTemplate(req.auth!.userId, req.body);
  return ApiResponse.created(res, 'Template created', { template });
}

export async function update(req: Request, res: Response): Promise<Response> {
  const template = await templateService.updateTemplate(req.params.id, req.auth!.userId, req.body);
  return ApiResponse.ok(res, 'Template updated', { template });
}

export async function remove(req: Request, res: Response): Promise<Response> {
  await templateService.deleteTemplate(req.params.id, req.auth!.userId);
  return ApiResponse.ok(res, 'Template deleted');
}

export async function processes(_req: Request, res: Response): Promise<Response> {
  const items = await templateService.listProcesses();
  return ApiResponse.ok(res, 'Email processes', { processes: items });
}

export async function assign(req: Request, res: Response): Promise<Response> {
  await templateService.assignToProcess(
    req.auth!.userId,
    req.params.processKey as EmailProcessKey,
    req.body.templateId ?? null,
  );
  return ApiResponse.ok(res, 'Process assignment updated');
}
