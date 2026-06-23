import { body, param } from 'express-validator';

export const createCouponValidators = [
  body('courseId').isMongoId(),
  body('code').isString().trim().isLength({ min: 3, max: 40 }),
  body('discountType').isIn(['fixed', 'percentage']),
  body('value').isInt({ min: 0 }),
  body('usageLimit').optional().isInt({ min: 0 }),
  body('expiresAt').optional().isISO8601(),
];

export const updateCouponValidators = [
  param('id').isMongoId(),
  body('discountType').optional().isIn(['fixed', 'percentage']),
  body('value').optional().isInt({ min: 0 }),
  body('usageLimit').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean().toBoolean(),
  body('expiresAt').optional().isISO8601(),
];

export const couponIdParam = [param('id').isMongoId()];

export const validateCouponValidators = [
  body('code').isString().trim().isLength({ min: 3, max: 40 }),
  body('courseId').isMongoId(),
];
