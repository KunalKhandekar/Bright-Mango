import { Schema, model, InferSchemaType, Types } from 'mongoose';

const paymentSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String, required: true, unique: true },
    razorpaySignature: { type: String, default: '' },
    verified: { type: Boolean, default: false },
    paidAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

paymentSchema.index({ orderId: 1 });

export type PaymentDoc = InferSchemaType<typeof paymentSchema> & { _id: Types.ObjectId };

export const Payment = model('Payment', paymentSchema);
