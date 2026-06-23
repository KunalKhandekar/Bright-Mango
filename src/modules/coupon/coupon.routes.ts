import { Router } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { rateLimiter } from '../../common/middlewares/rateLimiter.js';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import * as ctrl from './coupon.controller.js';
import {
  createCouponValidators,
  updateCouponValidators,
  couponIdParam,
  validateCouponValidators,
} from './coupon.validation.js';

const router = Router();
const manage = [authenticate, authorize(PERMISSIONS.COUPON_MANAGE)];

// Student validation (throttled to deter code brute-forcing)
router.post(
  '/validate',
  authenticate,
  rateLimiter({ prefix: 'coupon-validate', windowSeconds: 60, max: 15 }),
  validate(validateCouponValidators),
  asyncHandler(ctrl.validateCoupon),
);

// Mentor CRUD
router.get('/', ...manage, asyncHandler(ctrl.list));
router.post('/', ...manage, validate(createCouponValidators), asyncHandler(ctrl.create));
router.patch('/:id', ...manage, validate(updateCouponValidators), asyncHandler(ctrl.update));
router.delete('/:id', ...manage, validate(couponIdParam), asyncHandler(ctrl.remove));

export default router;
