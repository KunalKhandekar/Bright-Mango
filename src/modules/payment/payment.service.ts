import mongoose, { Types } from 'mongoose';
import { Order, OrderDoc } from './order.model.js';
import { Payment } from './payment.model.js';
import { getCourseOrThrow } from '../course/course.service.js';
import { hasAccess, enroll } from '../enrollment/enrollment.service.js';
import { applyCoupon, recordUsage } from '../coupon/coupon.service.js';
import * as razorpay from '../../integrations/razorpay.service.js';
import { verifyRazorpaySignature } from '../../common/utils/crypto.util.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../common/http/ApiError.js';
import { ErrorCode } from '../../common/http/errorCodes.js';
import { logger } from '../../common/utils/logger.js';

export interface CreateOrderResult {
  orderId: string;
  razorpayOrderId: string;
  amount: number;
  finalAmount: number;
  currency: string;
  keyId: string;
}

/**
 * Create an order. Price and coupon discount are recomputed server-side — the client
 * amount is never trusted. Blocks if the student already has access.
 */
export async function createOrder(
  studentId: string,
  courseId: string,
  couponCode?: string,
): Promise<CreateOrderResult> {
  if (await hasAccess(studentId, courseId)) {
    throw ApiError.conflict(ErrorCode.ALREADY_ENROLLED, 'You already have access to this course');
  }

  const course = await getCourseOrThrow(courseId);
  if (course.status !== 'published') {
    throw ApiError.badRequest(ErrorCode.COURSE_NOT_PUBLISHABLE, 'Course is not available for purchase');
  }

  let finalAmount = course.price;
  let couponId: Types.ObjectId | undefined;
  if (couponCode) {
    const applied = await applyCoupon(couponCode, courseId, course.price);
    finalAmount = applied.finalAmount;
    couponId = applied.couponId;
  }

  const rzpOrder = await razorpay.createOrder(finalAmount, `course_${courseId}_${studentId}`, {
    courseId,
    studentId,
  });

  const order = await Order.create({
    studentId,
    mentorId: course.mentorId,
    courseId,
    amount: course.price,
    finalAmount,
    couponId,
    razorpayOrderId: rzpOrder.id,
    status: 'pending',
  });

  return {
    orderId: order._id.toString(),
    razorpayOrderId: rzpOrder.id,
    amount: course.price,
    finalAmount,
    currency: rzpOrder.currency,
    keyId: env.razorpay.keyId,
  };
}

/**
 * Idempotent fulfillment — the single path both `/payments/verify` and the webhook use.
 * Marks the order paid, records the Payment, creates the Enrollment, and records coupon
 * usage, all in one transaction. Returns false if already fulfilled.
 */
export async function fulfillOrder(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
}): Promise<boolean> {
  // Idempotency guard — a payment id is processed at most once.
  if (await Payment.exists({ razorpayPaymentId: params.razorpayPaymentId })) {
    return false;
  }

  const order = await Order.findOne({ razorpayOrderId: params.razorpayOrderId });
  if (!order) throw ApiError.notFound('Order not found', ErrorCode.ORDER_NOT_FOUND);
  if (order.status === 'paid') return false;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      order.status = 'paid';
      await order.save({ session });

      await Payment.create(
        [
          {
            orderId: order._id,
            razorpayOrderId: params.razorpayOrderId,
            razorpayPaymentId: params.razorpayPaymentId,
            razorpaySignature: params.razorpaySignature ?? '',
            verified: true,
            paidAt: new Date(),
          },
        ],
        { session },
      );

      await enroll(
        {
          studentId: order.studentId,
          mentorId: order.mentorId,
          courseId: order.courseId,
          accessType: 'paid',
          orderId: order._id,
        },
        session,
      );

      if (order.couponId) {
        await recordUsage(order.couponId, order.studentId, order._id, session);
      }
    });
  } finally {
    await session.endSession();
  }
  return true;
}

/** Client-side verification: check signature, then fulfill. */
export async function verifyPayment(
  studentId: string,
  params: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
): Promise<{ fulfilled: boolean }> {
  const ok = verifyRazorpaySignature(
    params.razorpayOrderId,
    params.razorpayPaymentId,
    params.razorpaySignature,
    env.razorpay.keySecret,
  );
  if (!ok) {
    throw ApiError.badRequest(ErrorCode.PAYMENT_VERIFICATION_FAILED, 'Payment signature verification failed');
  }

  const order = await Order.findOne({ razorpayOrderId: params.razorpayOrderId }).lean<OrderDoc>();
  if (!order) throw ApiError.notFound('Order not found', ErrorCode.ORDER_NOT_FOUND);
  if (order.studentId.toString() !== studentId) {
    throw ApiError.forbidden('This order does not belong to you');
  }

  const fulfilled = await fulfillOrder(params);
  return { fulfilled };
}

/**
 * Razorpay webhook fallback. `payment.captured` carries the order + payment ids; fulfill
 * idempotently so a closed tab after payment still grants access.
 */
export async function handleWebhook(event: Record<string, unknown>): Promise<void> {
  const type = event.event as string;
  if (type !== 'payment.captured' && type !== 'order.paid') return;

  const payload = event.payload as { payment?: { entity?: Record<string, string> } };
  const entity = payload?.payment?.entity;
  if (!entity?.order_id || !entity?.id) {
    logger.warn({ type }, '[payment.webhook] missing ids in payload');
    return;
  }

  await fulfillOrder({ razorpayOrderId: entity.order_id, razorpayPaymentId: entity.id });
}

export async function getMyOrders(studentId: string): Promise<OrderDoc[]> {
  return Order.find({ studentId }).sort({ createdAt: -1 }).lean<OrderDoc[]>();
}
