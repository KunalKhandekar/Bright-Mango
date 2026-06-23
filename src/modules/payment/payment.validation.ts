import { body } from 'express-validator';

export const createOrderValidators = [
  body('courseId').isMongoId(),
  body('couponCode').optional().isString().trim().isLength({ min: 3, max: 40 }),
];

export const verifyPaymentValidators = [
  body('razorpayOrderId').isString().trim().notEmpty(),
  body('razorpayPaymentId').isString().trim().notEmpty(),
  body('razorpaySignature').isString().trim().notEmpty(),
];
