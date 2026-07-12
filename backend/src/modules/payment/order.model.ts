import { Schema, model, InferSchemaType, Types } from 'mongoose';

const orderSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mentorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },

    amount: { type: Number, required: true }, // original price (paise)
    finalAmount: { type: Number, required: true }, // after discount (paise)
    couponId: { type: Schema.Types.ObjectId, ref: 'Coupon' },

    razorpayOrderId: { type: String, required: true },
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

orderSchema.index({ studentId: 1 });
orderSchema.index({ courseId: 1 });
orderSchema.index({ mentorId: 1, status: 1, createdAt: -1 }); // income analytics + admin order list
orderSchema.index({ razorpayOrderId: 1 }, { unique: true });

export type OrderDoc = InferSchemaType<typeof orderSchema> & { _id: Types.ObjectId };

export const Order = model('Order', orderSchema);
