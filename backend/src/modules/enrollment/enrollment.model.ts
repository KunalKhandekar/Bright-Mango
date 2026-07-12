import { Schema, model, InferSchemaType, Types } from 'mongoose';

const enrollmentSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mentorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    accessType: { type: String, enum: ['paid', 'manual'], required: true },
    enrolledAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

enrollmentSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
enrollmentSchema.index({ courseId: 1 });
// Dashboard: mentor-scoped counts and enrollment timeseries.
enrollmentSchema.index({ mentorId: 1, enrolledAt: -1 });

export type EnrollmentDoc = InferSchemaType<typeof enrollmentSchema> & { _id: Types.ObjectId };

export const Enrollment = model('Enrollment', enrollmentSchema);
