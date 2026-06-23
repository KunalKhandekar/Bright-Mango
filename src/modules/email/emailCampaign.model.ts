import { Schema, model, InferSchemaType, Types } from 'mongoose';

const emailCampaignSchema = new Schema(
  {
    mentorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true }, // may contain {{name}}, {{progress}} tokens
    totalRecipients: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'sending', 'completed'], default: 'pending' },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

emailCampaignSchema.index({ mentorId: 1 });
emailCampaignSchema.index({ status: 1 });

export type EmailCampaignDoc = InferSchemaType<typeof emailCampaignSchema> & {
  _id: Types.ObjectId;
};

export const EmailCampaign = model('EmailCampaign', emailCampaignSchema);
