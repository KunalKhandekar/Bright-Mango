import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../common/http/ApiError.js';
import { ErrorCode } from '../../common/http/errorCodes.js';
import { ROLES } from '../../common/constants/roles.js';
import { Course } from '../course/course.model.js';
import { hasAccess } from './enrollment.service.js';

/**
 * Gate a content route on the caller being enrolled in the course.
 * `resolveCourseId` derives the courseId from the request (params/derived).
 * Mentors who own the course bypass the enrollment check.
 */
export function requireEnrollment(resolveCourseId: (req: Request) => Promise<string> | string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw ApiError.unauthorized();
      const courseId = await resolveCourseId(req);

      if (req.auth.role === ROLES.MENTOR) {
        const course = await Course.findById(courseId).select('mentorId').lean();
        if (course && course.mentorId.toString() === req.auth.userId) return next();
      }

      if (await hasAccess(req.auth.userId, courseId)) return next();

      throw ApiError.forbidden('You are not enrolled in this course', ErrorCode.ACCESS_NOT_ENROLLED);
    } catch (err) {
      next(err);
    }
  };
}
