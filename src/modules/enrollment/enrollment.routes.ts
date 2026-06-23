import { Router } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import * as ctrl from './enrollment.controller.js';
import { manualEnrollValidators, enrollmentIdParam, courseIdParam } from './enrollment.validation.js';

const router = Router();

router.get('/me', authenticate, asyncHandler(ctrl.listMine));
router.get('/me/:courseId', authenticate, validate(courseIdParam), asyncHandler(ctrl.getMine));

router.post(
  '/manual',
  authenticate,
  authorize(PERMISSIONS.ENROLLMENT_GRANT),
  validate(manualEnrollValidators),
  asyncHandler(ctrl.manual),
);
router.delete(
  '/:id',
  authenticate,
  authorize(PERMISSIONS.ENROLLMENT_REVOKE),
  validate(enrollmentIdParam),
  asyncHandler(ctrl.revoke),
);

export default router;
