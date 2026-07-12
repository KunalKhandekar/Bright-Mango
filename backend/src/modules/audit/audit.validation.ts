import { query } from 'express-validator';

export const listAuditLogsValidators = [
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
];
