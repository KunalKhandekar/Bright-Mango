import { Request } from 'express';

export interface DateRange {
  from: Date;
  to: Date;
}

/** Parse from/to query params, defaulting to the last 30 days. */
export function parseRange(req: Request): DateRange {
  const to = typeof req.query.to === 'string' ? new Date(req.query.to) : new Date();
  const from =
    typeof req.query.from === 'string'
      ? new Date(req.query.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}
