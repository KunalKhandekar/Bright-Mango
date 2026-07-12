import { Request, Response } from 'express';
import { ApiResponse } from '../../common/http/ApiResponse.js';
import { ApiError } from '../../common/http/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../common/utils/pagination.util.js';
import * as emailService from './email.service.js';

export async function create(req: Request, res: Response): Promise<Response> {
  const campaign = await emailService.createCampaign(req.auth!.userId, {
    subject: req.body.subject,
    body: req.body.body,
    audience: req.body.audience,
    scheduledFor: req.body.scheduledFor ? new Date(req.body.scheduledFor) : undefined,
  });
  return ApiResponse.created(
    res,
    campaign.status === 'scheduled' ? 'Campaign scheduled' : 'Campaign queued',
    { campaign },
  );
}

export async function cancel(req: Request, res: Response): Promise<Response> {
  const campaign = await emailService.cancelCampaign(req.params.id, req.auth!.userId);
  return ApiResponse.ok(res, 'Campaign cancelled', { campaign });
}

export async function list(req: Request, res: Response): Promise<Response> {
  const pagination = getPagination(req);
  const { items, total } = await emailService.listCampaigns(req.auth!.userId, pagination);
  return ApiResponse.ok(res, 'Campaigns', { campaigns: items }, buildPaginationMeta(total, pagination));
}

export async function getOne(req: Request, res: Response): Promise<Response> {
  const campaign = await emailService.getCampaign(req.params.id, req.auth!.userId);
  if (!campaign) throw ApiError.notFound('Campaign not found');
  return ApiResponse.ok(res, 'Campaign', { campaign });
}
