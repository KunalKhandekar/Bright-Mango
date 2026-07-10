import { Router } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import * as ctrl from './audit.controller.js';

const router = Router();

router.get('/', authenticate, authorize(PERMISSIONS.AUDIT_VIEW), asyncHandler(ctrl.list));

export default router;
