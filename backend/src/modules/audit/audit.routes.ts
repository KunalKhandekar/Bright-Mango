import { Router } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { validate } from '../../common/middlewares/validate.js';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import * as ctrl from './audit.controller.js';
import { listAuditLogsValidators } from './audit.validation.js';

const router = Router();

router.get('/actions', authenticate, authorize(PERMISSIONS.AUDIT_VIEW), asyncHandler(ctrl.filterOptions));
router.get(
  '/',
  authenticate,
  authorize(PERMISSIONS.AUDIT_VIEW),
  validate(listAuditLogsValidators),
  asyncHandler(ctrl.list),
);

export default router;
