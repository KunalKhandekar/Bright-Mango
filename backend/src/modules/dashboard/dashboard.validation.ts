import { query } from 'express-validator';

export const rangeValidators = [
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
];

export const timeseriesValidators = [
  ...rangeValidators,
  query('interval').optional().isIn(['day', 'month']),
];
