import { Schema, model, InferSchemaType, Types } from 'mongoose';

const recentlyWatchedSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    watchedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

recentlyWatchedSchema.index({ studentId: 1, lessonId: 1 }, { unique: true });
recentlyWatchedSchema.index({ studentId: 1, watchedAt: -1 });

export type RecentlyWatchedDoc = InferSchemaType<typeof recentlyWatchedSchema> & {
  _id: Types.ObjectId;
};

export const RecentlyWatched = model('RecentlyWatched', recentlyWatchedSchema);
