import { Router, raw } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { rateLimiter } from '../../common/middlewares/rateLimiter.js';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import * as ctrl from './payment.controller.js';
import {
  createOrderValidators,
  verifyPaymentValidators,
  analyticsRangeValidators,
  analyticsTimeseriesValidators,
  adminOrdersValidators,
} from './payment.validation.js';

const router = Router();

const orderLimiter = rateLimiter({ prefix: 'order-create', windowSeconds: 60, max: 10 });

router.post('/orders', authenticate, orderLimiter, validate(createOrderValidators), asyncHandler(ctrl.createOrder));
router.post('/payments/verify', authenticate, validate(verifyPaymentValidators), asyncHandler(ctrl.verify));
router.get('/orders/me', authenticate, asyncHandler(ctrl.myOrders));

// Admin income analytics (mentor-only)
const viewIncome = [authenticate, authorize(PERMISSIONS.PAYMENT_VIEW_ALL)];
router.get('/payments/analytics/summary', ...viewIncome, validate(analyticsRangeValidators), asyncHandler(ctrl.analyticsSummary));
router.get('/payments/analytics/by-course', ...viewIncome, validate(analyticsRangeValidators), asyncHandler(ctrl.analyticsByCourse));
router.get('/payments/analytics/timeseries', ...viewIncome, validate(analyticsTimeseriesValidators), asyncHandler(ctrl.analyticsTimeseries));
router.get('/payments/orders', ...viewIncome, validate(adminOrdersValidators), asyncHandler(ctrl.adminOrders));

// Webhook — raw body for signature verification (global JSON parser skips this path; see app.ts).
router.post('/payments/webhook', raw({ type: '*/*' }), asyncHandler(ctrl.webhook));

export default router;
