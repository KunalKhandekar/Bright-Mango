import { Schema, model, InferSchemaType, Types } from 'mongoose';

const couponUsageSchema = new Schema(
  {
    couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    usedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

couponUsageSchema.index({ couponId: 1 });
couponUsageSchema.index({ studentId: 1 });

export type CouponUsageDoc = InferSchemaType<typeof couponUsageSchema> & { _id: Types.ObjectId };

export const CouponUsage = model('CouponUsage', couponUsageSchema);
