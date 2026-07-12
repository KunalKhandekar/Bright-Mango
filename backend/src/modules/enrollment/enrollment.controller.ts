import { Request, Response } from 'express';
import { ApiResponse } from '../../common/http/ApiResponse.js';
import { getPagination, buildPaginationMeta } from '../../common/utils/pagination.util.js';
import * as enrollmentService from './enrollment.service.js';

export async function listMine(req: Request, res: Response): Promise<Response> {
  const pagination = getPagination(req);
  const { items, total } = await enrollmentService.listMyEnrollments(req.auth!.userId, pagination);
  return ApiResponse.ok(res, 'Your enrollments', { enrollments: items }, buildPaginationMeta(total, pagination));
}

export async function getMine(req: Request, res: Response): Promise<Response> {
  const enrollment = await enrollmentService.getMyEnrollment(req.auth!.userId, req.params.courseId);
  return ApiResponse.ok(res, 'Enrollment', { enrollment, hasAccess: enrollment !== null });
}

export async function listAll(req: Request, res: Response): Promise<Response> {
  const pagination = getPagination(req);
  const { items, total } = await enrollmentService.listForMentor(
    req.auth!.userId,
    {
      courseId: typeof req.query.courseId === 'string' ? req.query.courseId : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
    },
    pagination,
  );
  return ApiResponse.ok(res, 'Enrollments', { enrollments: items }, buildPaginationMeta(total, pagination));
}

export async function stats(req: Request, res: Response): Promise<Response> {
  const result = await enrollmentService.getEnrollmentStats(req.auth!.userId);
  return ApiResponse.ok(res, 'Enrollment stats', result);
}

export async function manual(req: Request, res: Response): Promise<Response> {
  const enrollment = await enrollmentService.manualEnroll(req.auth!.userId, req.body.email, req.body.courseId);
  return ApiResponse.created(res, 'Student enrolled', { enrollment });
}

export async function revoke(req: Request, res: Response): Promise<Response> {
  await enrollmentService.revoke(req.params.id, req.auth!.userId);
  return ApiResponse.ok(res, 'Enrollment revoked');
}
