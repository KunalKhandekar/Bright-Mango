import { Request, Response } from 'express';
import { ApiResponse } from '../../common/http/ApiResponse.js';
import { ApiError } from '../../common/http/ApiError.js';
import { ErrorCode } from '../../common/http/errorCodes.js';
import { verifyWebhookSignature } from '../../integrations/razorpay.service.js';
import { logger } from '../../common/utils/logger.js';
import * as paymentService from './payment.service.js';
import * as analytics from './payment.analytics.service.js';
import { getPagination, buildPaginationMeta } from '../../common/utils/pagination.util.js';

export async function createOrder(req: Request, res: Response): Promise<Response> {
  const data = await paymentService.createOrder(req.auth!.userId, req.body.courseId, req.body.couponCode);
  return ApiResponse.created(res, 'Order created', data);
}

export async function verify(req: Request, res: Response): Promise<Response> {
  const result = await paymentService.verifyPayment(req.auth!.userId, {
    razorpayOrderId: req.body.razorpayOrderId,
    razorpayPaymentId: req.body.razorpayPaymentId,
    razorpaySignature: req.body.razorpaySignature,
  });
  return ApiResponse.ok(res, 'Payment verified', result);
}

export async function myOrders(req: Request, res: Response): Promise<Response> {
  const orders = await paymentService.getMyOrders(req.auth!.userId);
  return ApiResponse.ok(res, 'Your orders', { orders });
}

// ── Admin income analytics ──────────────────────────────────────────────────────

/** Parse from/to query params, defaulting to the last 30 days. */
function parseRange(req: Request): analytics.DateRange {
  const to = typeof req.query.to === 'string' ? new Date(req.query.to) : new Date();
  const from =
    typeof req.query.from === 'string'
      ? new Date(req.query.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

export async function analyticsSummary(req: Request, res: Response): Promise<Response> {
  const summary = await analytics.getSummary(req.auth!.userId, parseRange(req));
  return ApiResponse.ok(res, 'Income summary', { summary });
}

export async function analyticsByCourse(req: Request, res: Response): Promise<Response> {
  const courses = await analytics.getRevenueByCourse(req.auth!.userId, parseRange(req));
  return ApiResponse.ok(res, 'Revenue by course', { courses });
}

export async function analyticsTimeseries(req: Request, res: Response): Promise<Response> {
  const interval = req.query.interval === 'month' ? 'month' : 'day';
  const points = await analytics.getRevenueTimeseries(req.auth!.userId, parseRange(req), interval);
  return ApiResponse.ok(res, 'Revenue over time', { points, interval });
}

export async function adminOrders(req: Request, res: Response): Promise<Response> {
  const pagination = getPagination(req);
  const status = req.query.status;
  const { items, total } = await analytics.listOrdersForMentor(
    req.auth!.userId,
    {
      status:
        status === 'pending' || status === 'paid' || status === 'failed' ? status : undefined,
      courseId: typeof req.query.courseId === 'string' ? req.query.courseId : undefined,
    },
    pagination,
  );
  return ApiResponse.ok(res, 'Orders', { orders: items }, buildPaginationMeta(total, pagination));
}

/**
 * Razorpay webhook. Uses the raw body (mounted with express.raw) to verify the signature
 * before parsing. Always returns 200 quickly so Razorpay does not retry on our slowness;
 * fulfillment is idempotent.
 */
export async function webhook(req: Request, res: Response): Promise<Response> {
  const signature = req.get('x-razorpay-signature') ?? '';
  const rawBody = req.body as Buffer;

  if (!verifyWebhookSignature(rawBody, signature)) {
    throw ApiError.badRequest(ErrorCode.PAYMENT_VERIFICATION_FAILED, 'Invalid webhook signature');
  }

  const event = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
  paymentService.handleWebhook(event).catch((err) => logger.error({ err }, '[payment.webhook] fulfill failed'));

  return ApiResponse.ok(res, 'ok');
}
