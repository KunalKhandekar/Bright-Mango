import { Schema, model, InferSchemaType, Types } from 'mongoose';

/** Emails blocked from requesting OTP / creating accounts. */
const emailBlacklistSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    reason: { type: String, default: '' },
    blockedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type EmailBlacklistDoc = InferSchemaType<typeof emailBlacklistSchema> & {
  _id: Types.ObjectId;
};

export const EmailBlacklist = model('EmailBlacklist', emailBlacklistSchema);
