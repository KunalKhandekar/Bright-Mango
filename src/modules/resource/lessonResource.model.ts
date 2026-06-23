import { Schema, model, InferSchemaType, Types } from 'mongoose';

const lessonResourceSchema = new Schema(
  {
    lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true, trim: true },
    // R2 object key (never the public URL — downloads are presigned on demand).
    fileKey: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    contentType: { type: String, default: 'application/octet-stream' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

lessonResourceSchema.index({ lessonId: 1 });

export type LessonResourceDoc = InferSchemaType<typeof lessonResourceSchema> & {
  _id: Types.ObjectId;
};

export const LessonResource = model('LessonResource', lessonResourceSchema);
