import { Request, Response } from 'express';
import { ApiResponse } from '../../common/http/ApiResponse.js';
import { ApiError } from '../../common/http/ApiError.js';
import { ErrorCode } from '../../common/http/errorCodes.js';
import { verifyWebhookSignature } from '../../integrations/razorpay.service.js';
import { logger } from '../../common/utils/logger.js';
import * as paymentService from './payment.service.js';

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
