import { Schema, model, InferSchemaType, Types } from 'mongoose';

/**
 * Links a student to a mentor. Enables future multi-mentor scaling: a student can be
 * mapped to more than one mentor, but (mentorId, studentId) is unique.
 */
const mentorStudentSchema = new Schema(
  {
    mentorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

mentorStudentSchema.index({ mentorId: 1 });
mentorStudentSchema.index({ studentId: 1 });
mentorStudentSchema.index({ mentorId: 1, studentId: 1 }, { unique: true });

export type MentorStudentDoc = InferSchemaType<typeof mentorStudentSchema> & {
  _id: Types.ObjectId;
};

export const MentorStudent = model('MentorStudent', mentorStudentSchema);
