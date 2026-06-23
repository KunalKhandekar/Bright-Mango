import { Schema, model, InferSchemaType, Types } from 'mongoose';

/** OTP-protected, 24h-delayed course deletion request. */
const courseDeletionRequestSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    mentorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    jobId: { type: String },
    executeAt: { type: Date, required: true },
    status: { type: String, enum: ['scheduled', 'cancelled', 'executed'], default: 'scheduled' },
  },
  { timestamps: true },
);

courseDeletionRequestSchema.index({ courseId: 1 });

export type CourseDeletionRequestDoc = InferSchemaType<typeof courseDeletionRequestSchema> & {
  _id: Types.ObjectId;
};

export const CourseDeletionRequest = model('CourseDeletionRequest', courseDeletionRequestSchema);
