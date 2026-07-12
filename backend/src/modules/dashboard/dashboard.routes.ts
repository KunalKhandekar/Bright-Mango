import { Router } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import * as ctrl from './dashboard.controller.js';
import { rangeValidators, timeseriesValidators } from './dashboard.validation.js';

const router = Router();

// Mentor overview dashboard (mentor-only)
const guard = [authenticate, authorize(PERMISSIONS.ADMIN_PANEL)];
router.get('/summary', ...guard, asyncHandler(ctrl.summary));
router.get('/enrollments/timeseries', ...guard, validate(timeseriesValidators), asyncHandler(ctrl.enrollmentTimeseries));
router.get('/engagement', ...guard, validate(rangeValidators), asyncHandler(ctrl.engagement));

export default router;
