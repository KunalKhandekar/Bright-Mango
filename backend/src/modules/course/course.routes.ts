import { Router } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import * as ctrl from './course.controller.js';
import {
  createCourseValidators,
  updateCourseValidators,
  thumbnailUploadValidators,
  courseIdParam,
  slugParam,
  confirmDeleteValidators,
} from './course.validation.js';

const router = Router();

// Public
router.get('/', asyncHandler(ctrl.listPublic));

// Mentor admin (declared before '/:slug' to avoid route capture)
router.get('/admin/mine', authenticate, authorize(PERMISSIONS.COURSE_UPDATE), asyncHandler(ctrl.listMine));
router.get('/admin/:id', authenticate, authorize(PERMISSIONS.COURSE_UPDATE), validate(courseIdParam), asyncHandler(ctrl.getMineById));
router.post(
  '/thumbnail/upload-url',
  authenticate,
  authorize(PERMISSIONS.COURSE_CREATE, PERMISSIONS.COURSE_UPDATE),
  validate(thumbnailUploadValidators),
  asyncHandler(ctrl.thumbnailUploadUrl),
);

router.post('/', authenticate, authorize(PERMISSIONS.COURSE_CREATE), validate(createCourseValidators), asyncHandler(ctrl.create));
router.patch('/:id', authenticate, authorize(PERMISSIONS.COURSE_UPDATE), validate(updateCourseValidators), asyncHandler(ctrl.update));
router.post('/:id/publish', authenticate, authorize(PERMISSIONS.COURSE_PUBLISH), validate(courseIdParam), asyncHandler(ctrl.publish));

// OTP-protected delete
router.post('/:id/delete/request', authenticate, authorize(PERMISSIONS.COURSE_DELETE), validate(courseIdParam), asyncHandler(ctrl.requestDelete));
router.post('/:id/delete/confirm', authenticate, authorize(PERMISSIONS.COURSE_DELETE), validate(confirmDeleteValidators), asyncHandler(ctrl.confirmDelete));
router.post('/:id/delete/cancel', authenticate, authorize(PERMISSIONS.COURSE_DELETE), validate(courseIdParam), asyncHandler(ctrl.cancelDelete));

// Public detail (last — catches remaining slugs)
router.get('/:slug', validate(slugParam), asyncHandler(ctrl.getBySlug));

export default router;
