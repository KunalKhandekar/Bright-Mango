import { Router } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { rateLimiter } from '../../common/middlewares/rateLimiter.js';
import { requireEnrollment } from '../enrollment/enrollment.access.js';
import { getLessonOrThrow } from '../lesson/lesson.service.js';
import * as ctrl from './progress.controller.js';
import { recordProgressValidators, courseIdParam } from './progress.validation.js';

const router = Router();

const enrollForLesson = requireEnrollment(async (req) => {
  const lesson = await getLessonOrThrow(req.params.lessonId);
  return lesson.courseId.toString();
});

// Throttle progress writes (player pings frequently).
const progressLimiter = rateLimiter({
  prefix: 'progress',
  windowSeconds: 10,
  max: 5,
  keyBy: (req) => `${req.auth?.userId ?? req.ip}:${req.params.lessonId}`,
});

router.put(
  '/lessons/:lessonId',
  authenticate,
  validate(recordProgressValidators),
  enrollForLesson,
  progressLimiter,
  asyncHandler(ctrl.record),
);
router.get('/courses/:courseId', authenticate, validate(courseIdParam), asyncHandler(ctrl.courseProgress));
router.get('/recent', authenticate, asyncHandler(ctrl.recent));

export default router;
