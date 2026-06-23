import { body, param } from 'express-validator';

const email = () =>
  body('email')
    .isEmail()
    .withMessage('A valid email is required')
    .bail()
    .normalizeEmail({ gmail_remove_dots: false });

export const requestOtpValidators = [email()];

export const resendOtpValidators = [email()];

export const verifyOtpValidators = [
  email(),
  body('otp')
    .isString()
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('OTP must be 6 digits'),
  body('deviceName').optional().isString().trim().isLength({ max: 120 }),
  body('rememberDevice').optional().isBoolean().toBoolean(),
];

export const trustedLoginValidators = [email()];

export const sessionIdParamValidators = [
  param('sessionId').isString().isLength({ min: 16, max: 128 }).withMessage('Invalid session id'),
];

export const studentIdParamValidators = [
  param('studentId').isMongoId().withMessage('Invalid student id'),
];

export const studentSessionParamValidators = [
  param('studentId').isMongoId().withMessage('Invalid student id'),
  param('sessionId').isString().isLength({ min: 16, max: 128 }).withMessage('Invalid session id'),
];
