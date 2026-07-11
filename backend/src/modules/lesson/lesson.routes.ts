import { Router, Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate, authenticateOptional } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import { requireEnrollment } from '../enrollment/enrollment.access.js';
import * as ctrl from './lesson.controller.js';
import { getLessonOrThrow } from './lesson.service.js';
import {
  createLessonValidators,
  updateLessonValidators,
  lessonIdParam,
  reorderLessonValidators,
} from './lesson.validation.js';

const router = Router();
const manage = [authenticate, authorize(PERMISSIONS.CONTENT_MANAGE)];

const enrollmentForLesson = requireEnrollment(async (req) => {
  const lesson = await getLessonOrThrow(req.params.id);
  return lesson.courseId.toString();
});

/**
 * Preview lessons are watchable by anyone (including logged-out guests) so they can act as
 * a public sample; every other lesson requires enrollment. `requireEnrollment` already
 * rejects unauthenticated callers with 401, so a guest hitting a non-preview lesson is
 * handled there.
 */
async function playbackGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lesson = await getLessonOrThrow(req.params.id);
    if (lesson.isPreview) return next();
    return enrollmentForLesson(req, res, next);
  } catch (err) {
    next(err);
  }
}

// Mentor content management
router.post('/chapters/:chapterId/lessons', ...manage, validate(createLessonValidators), asyncHandler(ctrl.create));
router.patch('/chapters/:chapterId/lessons/reorder', ...manage, validate(reorderLessonValidators), asyncHandler(ctrl.reorder));
router.post('/lessons/:id/video/upload-url', ...manage, validate(lessonIdParam), asyncHandler(ctrl.uploadUrl));
router.patch('/lessons/:id', ...manage, validate(updateLessonValidators), asyncHandler(ctrl.update));
router.delete('/lessons/:id', ...manage, validate(lessonIdParam), asyncHandler(ctrl.remove));

// Course curriculum (public for published courses; owner-only for drafts)
router.get('/courses/:courseId/lessons', authenticateOptional, asyncHandler(ctrl.listByCourse));

// Playback: preview lessons are public (optional auth), others are enrollment-gated.
router.get('/lessons/:id/playback', authenticateOptional, validate(lessonIdParam), playbackGate, asyncHandler(ctrl.playback));

export default router;
