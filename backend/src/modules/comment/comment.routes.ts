import { Router } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import { requireEnrollment } from '../enrollment/enrollment.access.js';
import { getLessonOrThrow } from '../lesson/lesson.service.js';
import * as ctrl from './comment.controller.js';
import { getCommentCourseId } from './comment.service.js';
import {
  lessonIdParam,
  commentIdParam,
  createCommentValidators,
  updateCommentValidators,
  replyValidators,
  listRecentValidators,
} from './comment.validation.js';

const router = Router();

const enrollForLesson = requireEnrollment(async (req) => {
  const lesson = await getLessonOrThrow(req.params.lessonId);
  return lesson.courseId.toString();
});
const enrollForComment = requireEnrollment((req) => getCommentCourseId(req.params.id));

// Mentor dashboard — recent comments across all lessons (declared before '/:lessonId').
router.get(
  '/recent',
  authenticate,
  authorize(PERMISSIONS.COMMENT_MODERATE),
  validate(listRecentValidators),
  asyncHandler(ctrl.recent),
);

// Lesson comment threads (enrollment-gated)
router.get('/lessons/:lessonId', authenticate, validate(lessonIdParam), enrollForLesson, asyncHandler(ctrl.list));
router.post('/lessons/:lessonId', authenticate, validate(createCommentValidators), enrollForLesson, asyncHandler(ctrl.create));
router.get('/:id/replies', authenticate, validate(commentIdParam), enrollForComment, asyncHandler(ctrl.replies));

// Edit/delete own; delete also allowed for mentor (moderation) — checked in service.
router.patch('/:id', authenticate, validate(updateCommentValidators), enrollForComment, asyncHandler(ctrl.update));
router.delete('/:id', authenticate, validate(commentIdParam), enrollForComment, asyncHandler(ctrl.remove));

// Mentor reply
router.post('/:id/reply', authenticate, authorize(PERMISSIONS.COMMENT_REPLY), validate(replyValidators), asyncHandler(ctrl.reply));

export default router;
