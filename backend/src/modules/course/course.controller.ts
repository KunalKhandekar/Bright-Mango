import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { ApiResponse } from '../../common/http/ApiResponse.js';
import { ApiError } from '../../common/http/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../common/utils/pagination.util.js';
import { findById } from '../user/user.service.js';
import * as courseService from './course.service.js';
import * as deletionService from './courseDeletion.service.js';

export async function create(req: Request, res: Response): Promise<Response> {
  const course = await courseService.createCourse(new Types.ObjectId(req.auth!.userId), req.body);
  return ApiResponse.created(res, 'Course created', { course });
}

export async function thumbnailUploadUrl(req: Request, res: Response): Promise<Response> {
  const data = await courseService.createThumbnailUploadUrl(req.auth!.userId, {
    fileName: req.body.fileName,
    contentType: req.body.contentType,
  });
  return ApiResponse.ok(res, 'Course thumbnail upload URL issued', data);
}

export async function update(req: Request, res: Response): Promise<Response> {
  const course = await courseService.updateCourse(req.params.id, req.auth!.userId, req.body);
  return ApiResponse.ok(res, 'Course updated', { course });
}

export async function publish(req: Request, res: Response): Promise<Response> {
  const course = await courseService.publishCourse(req.params.id, req.auth!.userId);
  return ApiResponse.ok(res, 'Course published', { course });
}

export async function listPublic(req: Request, res: Response): Promise<Response> {
  const pagination = getPagination(req);
  const { items, total } = await courseService.listPublishedCourses(pagination);
  return ApiResponse.ok(res, 'Courses', { courses: items }, buildPaginationMeta(total, pagination));
}

export async function getBySlug(req: Request, res: Response): Promise<Response> {
  const course = await courseService.getPublishedBySlug(req.params.slug);
  return ApiResponse.ok(res, 'Course', { course });
}

export async function getMetaById(req: Request, res: Response): Promise<Response> {
  const course = await courseService.getCourseMeta(req.params.id, req.auth?.userId);
  return ApiResponse.ok(res, 'Course', { course });
}

export async function listMine(req: Request, res: Response): Promise<Response> {
  const pagination = getPagination(req);
  const { items, total } = await courseService.listMentorCourses(req.auth!.userId, pagination);
  return ApiResponse.ok(res, 'Your courses', { courses: items }, buildPaginationMeta(total, pagination));
}

export async function getMineById(req: Request, res: Response): Promise<Response> {
  const course = await courseService.assertCourseOwner(req.params.id, req.auth!.userId);
  return ApiResponse.ok(res, 'Course', { course });
}

// ── OTP-protected deletion ───────────────────────────────────────────────────

async function mentorEmail(userId: string): Promise<string> {
  const user = await findById(userId);
  if (!user) throw ApiError.unauthorized();
  return user.email;
}

export async function requestDelete(req: Request, res: Response): Promise<Response> {
  const email = await mentorEmail(req.auth!.userId);
  await deletionService.requestCourseDeletion(req.params.id, req.auth!.userId, email);
  return ApiResponse.ok(res, 'Confirmation code sent to your email', {
    delayMinutes: env.courseDeleteDelayMinutes,
  });
}

export async function confirmDelete(req: Request, res: Response): Promise<Response> {
  const email = await mentorEmail(req.auth!.userId);
  const { executeAt } = await deletionService.confirmCourseDeletion(
    req.params.id,
    req.auth!.userId,
    email,
    req.body.otp,
  );
  const mins = env.courseDeleteDelayMinutes;
  const delay =
    mins % 60 === 0 ? `${mins / 60} hour${mins === 60 ? '' : 's'}` : `${mins} minutes`;
  return ApiResponse.ok(res, `Course scheduled for deletion in ${delay}`, { executeAt });
}

export async function cancelDelete(req: Request, res: Response): Promise<Response> {
  await deletionService.cancelCourseDeletion(req.params.id, req.auth!.userId);
  return ApiResponse.ok(res, 'Course deletion cancelled');
}
