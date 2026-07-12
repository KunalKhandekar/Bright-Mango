import { Schema, model, InferSchemaType, Types } from 'mongoose';

/** OTP-protected, delayed course deletion request (COURSE_DELETE_DELAY_MINUTES). */
const courseDeletionRequestSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    mentorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    jobId: { type: String },
    executeAt: { type: Date, required: true },
    status: { type: String, enum: ['scheduled', 'cancelled', 'executed'], default: 'scheduled' },
    // Course status at the moment deletion was confirmed, restored on cancel
    // (so cancelling doesn't demote a published course to draft).
    previousStatus: { type: String, enum: ['draft', 'published'], default: 'draft' },
  },
  { timestamps: true },
);

courseDeletionRequestSchema.index({ courseId: 1 });

export type CourseDeletionRequestDoc = InferSchemaType<typeof courseDeletionRequestSchema> & {
  _id: Types.ObjectId;
};

export const CourseDeletionRequest = model('CourseDeletionRequest', courseDeletionRequestSchema);
