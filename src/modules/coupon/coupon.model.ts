import { Schema, model, InferSchemaType, Types } from 'mongoose';

const couponSchema = new Schema(
  {
    mentorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    discountType: { type: String, enum: ['fixed', 'percentage'], required: true },
    value: { type: Number, required: true, min: 0 }, // paise (fixed) or percent (percentage)
    usageLimit: { type: Number, default: 0 }, // 0 = unlimited
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

couponSchema.index({ mentorId: 1 });
couponSchema.index({ code: 1, courseId: 1 }, { unique: true });

export type CouponDoc = InferSchemaType<typeof couponSchema> & { _id: Types.ObjectId };

export const Coupon = model('Coupon', couponSchema);
