import { Schema, model, InferSchemaType, Types } from 'mongoose';

export const COURSE_STATUS = ['draft', 'published', 'scheduled_delete'] as const;

const courseSchema = new Schema(
  {
    mentorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },

    thumbnailUrl: { type: String, default: '' },
    thumbnailKey: { type: String, default: '' },
    shortDescription: { type: String, default: '' },
    description: { type: String, default: '' },

    price: { type: Number, required: true, min: 0 }, // in paise

    status: { type: String, enum: COURSE_STATUS, default: 'draft' },

    publishedAt: { type: Date },

    // When set, the moment the scheduled hard-delete will run (COURSE_DELETE_DELAY_MINUTES after confirm).
    // Cleared on cancel; drives the countdown banner in the mentor UI.
    scheduledDeleteAt: { type: Date, default: null },
  },
  { timestamps: true },
);

courseSchema.index({ mentorId: 1 });
courseSchema.index({ status: 1 });

export type CourseDoc = InferSchemaType<typeof courseSchema> & { _id: Types.ObjectId };

export const Course = model('Course', courseSchema);
