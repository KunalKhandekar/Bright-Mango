import { Schema, model, InferSchemaType, Types } from 'mongoose';
import { EMAIL_PROCESS_KEYS } from './emailTemplate.constants.js';

/**
 * Mentor-authored email template. At most one template is assigned per process
 * (sparse-unique processKey); unassigned processes fall back to the built-in
 * defaults in emailTemplate.constants.ts.
 */
const emailTemplateSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    subject: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 50000 },
    processKey: { type: String, enum: EMAIL_PROCESS_KEYS },
  },
  { timestamps: true },
);

emailTemplateSchema.index({ processKey: 1 }, { unique: true, sparse: true });

export type EmailTemplateDoc = InferSchemaType<typeof emailTemplateSchema> & { _id: Types.ObjectId };

export const EmailTemplate = model('EmailTemplate', emailTemplateSchema);
