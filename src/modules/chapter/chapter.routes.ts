import { Router } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import * as ctrl from './chapter.controller.js';
import {
  createChapterValidators,
  updateChapterValidators,
  chapterIdParam,
  courseIdParam,
  reorderValidators,
} from './chapter.validation.js';

// mergeParams so nested :courseId is available.
const router = Router({ mergeParams: true });
const manage = [authenticate, authorize(PERMISSIONS.CONTENT_MANAGE)];

router.get('/courses/:courseId/chapters', validate(courseIdParam), asyncHandler(ctrl.list));
router.post('/courses/:courseId/chapters', ...manage, validate(createChapterValidators), asyncHandler(ctrl.create));
router.patch('/courses/:courseId/chapters/reorder', ...manage, validate(reorderValidators), asyncHandler(ctrl.reorder));

router.patch('/chapters/:id', ...manage, validate(updateChapterValidators), asyncHandler(ctrl.update));
router.delete('/chapters/:id', ...manage, validate(chapterIdParam), asyncHandler(ctrl.remove));

export default router;
