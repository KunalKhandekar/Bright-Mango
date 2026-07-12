import { body, param, query } from 'express-validator';
import {
  BUG_REPORT_CATEGORIES,
  BUG_REPORT_SEVERITIES,
  BUG_REPORT_STATUSES,
} from './bugReport.model.js';

export const screenshotUploadValidators = [
  body('fileName').isString().trim().isLength({ min: 1, max: 255 }),
  body('contentType')
    .isString()
    .matches(/^image\/[a-z0-9.+-]+$/i)
    .withMessage('Screenshots must be an image'),
];

export const createBugReportValidators = [
  body('title').isString().trim().isLength({ min: 3, max: 200 }),
  body('description').isString().trim().isLength({ min: 10, max: 5000 }),
  body('category').isIn(BUG_REPORT_CATEGORIES),
  body('severity').optional().isIn(BUG_REPORT_SEVERITIES),
  body('pageUrl').optional().isString().trim().isLength({ max: 2000 }),
  body('screenshotKey').optional({ values: 'null' }).isString().trim().isLength({ min: 1, max: 500 }),
];

export const listBugReportsValidators = [
  query('status').optional().isIn(BUG_REPORT_STATUSES),
  query('category').optional().isIn(BUG_REPORT_CATEGORIES),
  query('severity').optional().isIn(BUG_REPORT_SEVERITIES),
];

export const updateBugReportValidators = [
  param('id').isMongoId(),
  body('status').optional().isIn(BUG_REPORT_STATUSES),
  body('adminNote').optional().isString().trim().isLength({ max: 2000 }),
];

export const bugReportIdParam = [param('id').isMongoId()];
