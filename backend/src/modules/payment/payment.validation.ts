import { body, query } from 'express-validator';

export const createOrderValidators = [
  body('courseId').isMongoId(),
  body('couponCode').optional().isString().trim().isLength({ min: 3, max: 40 }),
];

export const verifyPaymentValidators = [
  body('razorpayOrderId').isString().trim().notEmpty(),
  body('razorpayPaymentId').isString().trim().notEmpty(),
  body('razorpaySignature').isString().trim().notEmpty(),
];

export const analyticsRangeValidators = [
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
];

export const analyticsTimeseriesValidators = [
  ...analyticsRangeValidators,
  query('interval').optional().isIn(['day', 'month']),
];

export const adminOrdersValidators = [
  query('status').optional().isIn(['pending', 'paid', 'failed']),
  query('courseId').optional().isMongoId(),
];
