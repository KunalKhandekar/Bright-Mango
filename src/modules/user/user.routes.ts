import { Router } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import * as ctrl from './user.controller.js';
import {
  updateProfileValidators,
  studentIdParam,
  blacklistValidators,
  emailParam,
} from './user.validation.js';

const router = Router();

// Self
router.get('/me', authenticate, asyncHandler(ctrl.me));
router.patch('/me', authenticate, validate(updateProfileValidators), asyncHandler(ctrl.updateMe));

// Mentor — student management
router.get('/students', authenticate, authorize(PERMISSIONS.STUDENT_VIEW_ALL), asyncHandler(ctrl.listStudents));
router.get('/students/:id', authenticate, authorize(PERMISSIONS.STUDENT_VIEW_ALL), validate(studentIdParam), asyncHandler(ctrl.getStudent));
router.get('/students/:id/enrollments', authenticate, authorize(PERMISSIONS.ENROLLMENT_VIEW_ALL), validate(studentIdParam), asyncHandler(ctrl.studentEnrollments));
router.post('/students/:id/ban', authenticate, authorize(PERMISSIONS.STUDENT_BAN), validate(studentIdParam), asyncHandler(ctrl.ban));
router.post('/students/:id/unban', authenticate, authorize(PERMISSIONS.STUDENT_BAN), validate(studentIdParam), asyncHandler(ctrl.unban));

// Mentor — email blacklist
router.get('/blacklist', authenticate, authorize(PERMISSIONS.EMAIL_BLACKLIST), asyncHandler(ctrl.listBlacklist));
router.post('/blacklist', authenticate, authorize(PERMISSIONS.EMAIL_BLACKLIST), validate(blacklistValidators), asyncHandler(ctrl.blacklist));
router.delete('/blacklist/:email', authenticate, authorize(PERMISSIONS.EMAIL_BLACKLIST), validate(emailParam), asyncHandler(ctrl.unblacklist));

export default router;
