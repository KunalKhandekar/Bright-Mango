import { Schema, model, InferSchemaType, Types } from 'mongoose';

const chapterSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

chapterSchema.index({ courseId: 1, order: 1 });

export type ChapterDoc = InferSchemaType<typeof chapterSchema> & { _id: Types.ObjectId };

export const Chapter = model('Chapter', chapterSchema);
