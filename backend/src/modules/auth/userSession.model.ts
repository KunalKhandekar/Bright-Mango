import { Schema, model, InferSchemaType, Types } from 'mongoose';

/**
 * Durable session analytics / management record. The AUTHORITATIVE session store is
 * Redis (`session:{id}`); this collection exists so the mentor can view & manage student
 * sessions and so we keep history after a session is revoked (isActive=false).
 */
const userSessionSchema = new Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    deviceId: { type: String, required: true },
    deviceName: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    ipAddress: { type: String, default: '' },

    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: Date.now },
    revokedAt: { type: Date },
  },
  { timestamps: true },
);

userSessionSchema.index({ userId: 1, isActive: 1 });

export type UserSessionDoc = InferSchemaType<typeof userSessionSchema> & { _id: Types.ObjectId };

export const UserSession = model('UserSession', userSessionSchema);
