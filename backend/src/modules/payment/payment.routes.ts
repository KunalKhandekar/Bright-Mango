import { Router, raw } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { rateLimiter } from '../../common/middlewares/rateLimiter.js';
import * as ctrl from './payment.controller.js';
import { createOrderValidators, verifyPaymentValidators } from './payment.validation.js';

const router = Router();

const orderLimiter = rateLimiter({ prefix: 'order-create', windowSeconds: 60, max: 10 });

router.post('/orders', authenticate, orderLimiter, validate(createOrderValidators), asyncHandler(ctrl.createOrder));
router.post('/payments/verify', authenticate, validate(verifyPaymentValidators), asyncHandler(ctrl.verify));
router.get('/orders/me', authenticate, asyncHandler(ctrl.myOrders));

// Webhook — raw body for signature verification (global JSON parser skips this path; see app.ts).
router.post('/payments/webhook', raw({ type: '*/*' }), asyncHandler(ctrl.webhook));

export default router;
