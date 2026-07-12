import { Schema, model, InferSchemaType, Types } from 'mongoose';

const lessonProgressSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true },

    // High-water mark: the furthest playback position ever reached, capped at lesson
    // duration. Powers the monotonic course-progress bar.
    watchedSeconds: { type: Number, default: 0 },
    // Resume bookmark: the latest playback position the student was at.
    lastPositionSeconds: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    completionPercentage: { type: Number, default: 0 },
    lastWatchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

lessonProgressSchema.index({ studentId: 1, courseId: 1 });
lessonProgressSchema.index({ studentId: 1, lessonId: 1 }, { unique: true });
// Dashboard: per-course engagement (active students / completion) aggregations.
lessonProgressSchema.index({ courseId: 1, lastWatchedAt: -1 });

export type LessonProgressDoc = InferSchemaType<typeof lessonProgressSchema> & {
  _id: Types.ObjectId;
};

export const LessonProgress = model('LessonProgress', lessonProgressSchema);
