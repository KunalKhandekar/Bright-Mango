import { Router } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import { requireEnrollment } from '../enrollment/enrollment.access.js';
import { getLessonOrThrow } from '../lesson/lesson.service.js';
import * as ctrl from './resource.controller.js';
import { getResourceCourseId } from './resource.service.js';
import {
  uploadUrlValidators,
  createResourceValidators,
  lessonIdParam,
  resourceIdParam,
} from './resource.validation.js';

const router = Router();
const manage = [authenticate, authorize(PERMISSIONS.CONTENT_MANAGE)];

const enrollForLesson = requireEnrollment(async (req) => {
  const lesson = await getLessonOrThrow(req.params.lessonId);
  return lesson.courseId.toString();
});
const enrollForResource = requireEnrollment((req) => getResourceCourseId(req.params.id));

// Mentor
router.post('/lessons/:lessonId/resources/upload-url', ...manage, validate(uploadUrlValidators), asyncHandler(ctrl.uploadUrl));
router.post('/lessons/:lessonId/resources', ...manage, validate(createResourceValidators), asyncHandler(ctrl.create));
router.delete('/resources/:id', ...manage, validate(resourceIdParam), asyncHandler(ctrl.remove));

// Student (enrollment-gated)
router.get('/lessons/:lessonId/resources', authenticate, validate(lessonIdParam), enrollForLesson, asyncHandler(ctrl.list));
router.get('/resources/:id/download', authenticate, validate(resourceIdParam), enrollForResource, asyncHandler(ctrl.download));

export default router;
