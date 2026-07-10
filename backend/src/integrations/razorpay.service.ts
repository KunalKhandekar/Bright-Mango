import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env.js';
import { ApiError } from '../common/http/ApiError.js';
import { ErrorCode } from '../common/http/errorCodes.js';
import { safeEqual } from '../common/utils/crypto.util.js';

let instance: Razorpay | null = null;

function getClient(): Razorpay {
  if (!env.razorpay.keyId || !env.razorpay.keySecret) {
    throw new ApiError(503, ErrorCode.INTEGRATION_NOT_CONFIGURED, 'Razorpay is not configured');
  }
  if (instance) return instance;
  instance = new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
  return instance;
}

export interface CreatedOrder {
  id: string;
  amount: number;
  currency: string;
}

/** Create a Razorpay order. `amountPaise` is the final, server-computed amount in paise. */
export async function createOrder(
  amountPaise: number,
  receipt: string,
  notes: Record<string, string> = {},
): Promise<CreatedOrder> {
  const order = await getClient().orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt,
    notes,
  });
  return { id: order.id, amount: Number(order.amount), currency: order.currency };
}

/** Verify a Razorpay webhook signature against the raw request body. */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
  if (!env.razorpay.webhookSecret) return false;
  const expected = crypto
    .createHmac('sha256', env.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');
  return safeEqual(expected, signature);
}
