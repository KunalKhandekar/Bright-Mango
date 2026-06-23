import { Router, Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
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

/** Preview lessons are watchable without enrollment; otherwise enforce enrollment. */
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

// Student playback (enrollment-gated, preview-exempt)
router.get('/lessons/:id/playback', authenticate, validate(lessonIdParam), playbackGate, asyncHandler(ctrl.playback));

export default router;
