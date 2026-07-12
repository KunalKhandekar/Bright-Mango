import { Router } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { rateLimiter } from '../../common/middlewares/rateLimiter.js';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import * as ctrl from './bugReport.controller.js';
import {
  screenshotUploadValidators,
  createBugReportValidators,
  listBugReportsValidators,
  updateBugReportValidators,
  bugReportIdParam,
} from './bugReport.validation.js';

const router = Router();
const manage = [authenticate, authorize(PERMISSIONS.BUG_REPORT_MANAGE)];

const createLimiter = rateLimiter({
  prefix: 'bug-report-create',
  windowSeconds: 60 * 60,
  max: 5,
  keyBy: (req) => req.auth?.userId ?? req.ip ?? 'unknown',
  message: 'Too many bug reports. Try again later.',
});

const screenshotUploadLimiter = rateLimiter({
  prefix: 'bug-report-screenshot',
  windowSeconds: 60 * 60,
  max: 10,
  keyBy: (req) => req.auth?.userId ?? req.ip ?? 'unknown',
  message: 'Too many screenshot uploads. Try again later.',
});

// Any authenticated user
router.post(
  '/screenshot-upload-url',
  authenticate,
  screenshotUploadLimiter,
  validate(screenshotUploadValidators),
  asyncHandler(ctrl.screenshotUploadUrl),
);
router.post('/', authenticate, createLimiter, validate(createBugReportValidators), asyncHandler(ctrl.create));
router.get('/mine', authenticate, asyncHandler(ctrl.mine));

// Admin (declared before '/:id' routes)
router.get('/filters', ...manage, asyncHandler(ctrl.filterOptions));
router.get('/open-count', ...manage, asyncHandler(ctrl.openCount));
router.get('/', ...manage, validate(listBugReportsValidators), asyncHandler(ctrl.list));
router.patch('/:id', ...manage, validate(updateBugReportValidators), asyncHandler(ctrl.update));

// Screenshot view — admin or the reporter (checked in service)
router.get('/:id/screenshot', authenticate, validate(bugReportIdParam), asyncHandler(ctrl.screenshot));

export default router;
