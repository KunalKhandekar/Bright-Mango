import { Schema, model, InferSchemaType, Types } from 'mongoose';

const emailCampaignSchema = new Schema(
  {
    mentorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true }, // may contain {{name}}, {{email}} tokens
    audience: {
      type: { type: String, enum: ['all', 'course', 'students'], default: 'all', required: true },
      courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
      studentIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    },
    totalRecipients: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'sending', 'completed', 'cancelled'],
      default: 'pending',
    },
    /** UTC instant a scheduled campaign dispatches at. */
    scheduledFor: { type: Date },
    /** BullMQ delayed-job id, persisted so a scheduled dispatch can be cancelled. */
    scheduleJobId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

emailCampaignSchema.index({ mentorId: 1 });
emailCampaignSchema.index({ status: 1 });

export type EmailCampaignDoc = InferSchemaType<typeof emailCampaignSchema> & {
  _id: Types.ObjectId;
};

export const EmailCampaign = model('EmailCampaign', emailCampaignSchema);
