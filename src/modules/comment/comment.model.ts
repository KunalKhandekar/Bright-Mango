import { Schema, model, InferSchemaType, Types } from 'mongoose';

const commentSchema = new Schema(
  {
    lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    parentCommentId: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
    rootCommentId: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
    ancestorIds: [{ type: Schema.Types.ObjectId, ref: 'Comment' }],
    depth: { type: Number, required: true, default: 0, min: 0 },
    directReplyCount: { type: Number, required: true, default: 0, min: 0 },
    content: { type: String, required: true, trim: true },
    isEdited: { type: Boolean, default: false },
  },
  { timestamps: true },
);

commentSchema.index({ lessonId: 1, parentCommentId: 1, createdAt: 1 });
commentSchema.index({ courseId: 1, createdAt: -1 });
commentSchema.index({ ancestorIds: 1 });
commentSchema.index({ rootCommentId: 1, createdAt: 1 });

export type CommentDoc = InferSchemaType<typeof commentSchema> & { _id: Types.ObjectId };

export const Comment = model('Comment', commentSchema);
