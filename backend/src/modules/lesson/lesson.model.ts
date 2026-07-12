import { Schema, model, InferSchemaType, Types } from 'mongoose';

const lessonSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    chapterId: { type: Schema.Types.ObjectId, ref: 'Chapter', required: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    thumbnailUrl: { type: String, default: '' },

    // Cloudflare Stream: `videoUid` is set at upload; `videoPlaybackId` once encoding completes.
    videoUid: { type: String, default: null },
    videoPlaybackId: { type: String, default: null },
    videoStatus: { type: String, enum: ['none', 'processing', 'ready', 'error'], default: 'none' },
    durationSeconds: { type: Number, default: 0 },
    subtitlesUrl: { type: String, default: '' },

    order: { type: Number, required: true, default: 0 },
    isPreview: { type: Boolean, default: false },
  },
  { timestamps: true },
);

lessonSchema.index({ courseId: 1 });
lessonSchema.index({ chapterId: 1, order: 1 });

export type LessonDoc = InferSchemaType<typeof lessonSchema> & { _id: Types.ObjectId };

export const Lesson = model('Lesson', lessonSchema);
