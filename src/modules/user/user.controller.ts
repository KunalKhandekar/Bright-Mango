import { Request, Response } from 'express';
import { ApiResponse } from '../../common/http/ApiResponse.js';
import { getPagination, buildPaginationMeta } from '../../common/utils/pagination.util.js';
import { createAvatarUploadUrl, findById } from './user.service.js';
import { ApiError } from '../../common/http/ApiError.js';
import * as admin from './user.admin.service.js';

export async function me(req: Request, res: Response): Promise<Response> {
  const user = await findById(req.auth!.userId);
  if (!user) throw ApiError.unauthorized();
  return ApiResponse.ok(res, 'Profile', { user });
}

export async function avatarUploadUrl(req: Request, res: Response): Promise<Response> {
  const data = await createAvatarUploadUrl(req.auth!.userId, {
    fileName: req.body.fileName,
    contentType: req.body.contentType,
  });
  return ApiResponse.ok(res, 'Avatar upload URL issued', data);
}

export async function updateMe(req: Request, res: Response): Promise<Response> {
  const user = await admin.updateProfile(req.auth!.userId, {
    name: req.body.name,
    avatar: req.body.avatar,
  });
  return ApiResponse.ok(res, 'Profile updated', { user });
}

export async function listStudents(req: Request, res: Response): Promise<Response> {
  const pagination = getPagination(req);
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const { items, total } = await admin.listStudents(req.auth!.userId, search, pagination);
  return ApiResponse.ok(res, 'Students', { students: items }, buildPaginationMeta(total, pagination));
}

export async function getStudent(req: Request, res: Response): Promise<Response> {
  const student = await admin.getStudent(req.params.id);
  return ApiResponse.ok(res, 'Student', { student });
}

export async function ban(req: Request, res: Response): Promise<Response> {
  await admin.banStudent(req.auth!.userId, req.params.id);
  return ApiResponse.ok(res, 'Student banned');
}

export async function unban(req: Request, res: Response): Promise<Response> {
  await admin.unbanStudent(req.auth!.userId, req.params.id);
  return ApiResponse.ok(res, 'Student unbanned');
}

export async function studentEnrollments(req: Request, res: Response): Promise<Response> {
  const enrollments = await admin.listStudentEnrollments(req.params.id);
  return ApiResponse.ok(res, 'Student enrollments', { enrollments });
}

export async function blacklist(req: Request, res: Response): Promise<Response> {
  await admin.blacklistEmail(req.auth!.userId, req.body.email, req.body.reason ?? '');
  return ApiResponse.ok(res, 'Email blacklisted');
}

export async function listBlacklist(_req: Request, res: Response): Promise<Response> {
  const entries = await admin.listBlacklist();
  return ApiResponse.ok(res, 'Blacklisted emails', { entries });
}

export async function unblacklist(req: Request, res: Response): Promise<Response> {
  await admin.removeFromBlacklist(req.auth!.userId, req.params.email);
  return ApiResponse.ok(res, 'Email removed from blacklist');
}
