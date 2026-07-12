import { body, param } from 'express-validator';
import { EMAIL_PROCESS_KEYS } from './emailTemplate.constants.js';

export const createTemplateValidators = [
  body('name').isString().trim().isLength({ min: 1, max: 100 }),
  body('subject').isString().trim().isLength({ min: 1, max: 200 }),
  body('body').isString().isLength({ min: 1, max: 50000 }),
];

export const updateTemplateValidators = [
  param('id').isMongoId(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('subject').optional().isString().trim().isLength({ min: 1, max: 200 }),
  body('body').optional().isString().isLength({ min: 1, max: 50000 }),
];

export const templateIdParam = [param('id').isMongoId()];

export const assignProcessValidators = [
  param('processKey').isIn(EMAIL_PROCESS_KEYS),
  body('templateId').optional({ values: 'null' }).isMongoId(),
];
