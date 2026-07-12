import { Schema, model, InferSchemaType, Types } from 'mongoose';

export const BUG_REPORT_STATUSES = ['open', 'in_progress', 'resolved', 'dismissed'] as const;
export type BugReportStatus = (typeof BUG_REPORT_STATUSES)[number];

export const BUG_REPORT_CATEGORIES = ['playback', 'payment', 'content', 'account', 'other'] as const;
export type BugReportCategory = (typeof BUG_REPORT_CATEGORIES)[number];

export const BUG_REPORT_SEVERITIES = ['low', 'medium', 'high'] as const;
export type BugReportSeverity = (typeof BUG_REPORT_SEVERITIES)[number];

const bugReportSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, enum: BUG_REPORT_CATEGORIES, required: true },
    severity: { type: String, enum: BUG_REPORT_SEVERITIES, default: 'medium' },
    status: { type: String, enum: BUG_REPORT_STATUSES, default: 'open' },
    // Auto-captured client context — pageUrl from the SPA, userAgent from the request header.
    context: {
      pageUrl: { type: String, default: '' },
      userAgent: { type: String, default: '' },
    },
    // R2 object key; served via short-lived presigned GET like lesson resources.
    screenshotKey: { type: String, default: null },
    adminNote: { type: String, default: '' },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

bugReportSchema.index({ status: 1, createdAt: -1 });
bugReportSchema.index({ userId: 1, createdAt: -1 });

export type BugReportDoc = InferSchemaType<typeof bugReportSchema> & { _id: Types.ObjectId };

export const BugReport = model('BugReport', bugReportSchema);
