import { Types, ClientSession } from 'mongoose';
import { Coupon, CouponDoc } from './coupon.model.js';
import { CouponUsage } from './couponUsage.model.js';
import { assertCourseOwner } from '../course/course.service.js';
import { auditLog } from '../audit/audit.service.js';
import { ApiError } from '../../common/http/ApiError.js';
import { ErrorCode } from '../../common/http/errorCodes.js';

export interface CouponInput {
  courseId: string;
  code: string;
  discountType: 'fixed' | 'percentage';
  value: number;
  usageLimit?: number;
  expiresAt?: string;
}

export async function createCoupon(mentorId: string, input: CouponInput): Promise<CouponDoc> {
  await assertCourseOwner(input.courseId, mentorId);
  const coupon = await Coupon.create({
    mentorId,
    courseId: input.courseId,
    code: input.code.toUpperCase().trim(),
    discountType: input.discountType,
    value: input.value,
    usageLimit: input.usageLimit ?? 0,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
  });
  auditLog({ userId: mentorId, action: 'COUPON_CREATED', entityType: 'Coupon', entityId: coupon._id });
  return coupon.toObject() as CouponDoc;
}

async function loadOwned(couponId: string, mentorId: string): Promise<CouponDoc> {
  const coupon = await Coupon.findById(couponId).lean<CouponDoc>();
  if (!coupon) throw ApiError.notFound('Coupon not found');
  if (coupon.mentorId.toString() !== mentorId) {
    throw ApiError.forbidden('Not your coupon', ErrorCode.OWNERSHIP_REQUIRED);
  }
  return coupon;
}

export async function updateCoupon(
  couponId: string,
  mentorId: string,
  patch: Partial<Omit<CouponInput, 'courseId' | 'code'>> & { isActive?: boolean },
): Promise<CouponDoc> {
  await loadOwned(couponId, mentorId);
  const update: Record<string, unknown> = { ...patch };
  if (patch.expiresAt) update.expiresAt = new Date(patch.expiresAt);
  const updated = await Coupon.findByIdAndUpdate(couponId, { $set: update }, { new: true }).lean<CouponDoc>();
  return updated!;
}

export async function deleteCoupon(couponId: string, mentorId: string): Promise<void> {
  await loadOwned(couponId, mentorId);
  await Coupon.deleteOne({ _id: couponId });
}

export async function listCoupons(mentorId: string): Promise<CouponDoc[]> {
  return Coupon.find({ mentorId }).sort({ createdAt: -1 }).lean<CouponDoc[]>();
}

export interface AppliedCoupon {
  couponId: Types.ObjectId;
  discount: number;
  finalAmount: number;
}

/**
 * Validate a coupon against a course + price and compute the discount server-side.
 * The single source for both `POST /coupons/validate` and order creation.
 * Throws COUPON_INVALID on any failure. Does NOT mutate usedCount (that happens only on
 * successful payment, inside the payment transaction).
 */
export async function applyCoupon(
  code: string,
  courseId: string,
  price: number,
): Promise<AppliedCoupon> {
  const coupon = await Coupon.findOne({ code: code.toUpperCase().trim(), courseId }).lean<CouponDoc>();
  if (!coupon || !coupon.isActive) {
    throw ApiError.badRequest(ErrorCode.COUPON_INVALID, 'Invalid coupon code');
  }
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest(ErrorCode.COUPON_INVALID, 'Coupon has expired');
  }
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    throw ApiError.badRequest(ErrorCode.COUPON_INVALID, 'Coupon usage limit reached');
  }

  const rawDiscount =
    coupon.discountType === 'percentage' ? Math.floor((price * coupon.value) / 100) : coupon.value;
  const discount = Math.min(rawDiscount, price);
  return { couponId: coupon._id, discount, finalAmount: Math.max(0, price - discount) };
}

/** Record usage + increment count atomically — called inside the payment transaction. */
export async function recordUsage(
  couponId: Types.ObjectId,
  studentId: Types.ObjectId,
  orderId: Types.ObjectId,
  session: ClientSession,
): Promise<void> {
  await Coupon.updateOne({ _id: couponId }, { $inc: { usedCount: 1 } }, { session });
  await CouponUsage.create([{ couponId, studentId, orderId, usedAt: new Date() }], { session });
}
