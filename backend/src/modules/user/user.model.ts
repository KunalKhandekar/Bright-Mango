import { Schema, model, InferSchemaType, Types } from 'mongoose';
import { ALL_ROLES, ROLES } from '../../common/constants/roles.js';

/**
 * Single users collection for BOTH mentors and students (per design — do NOT split).
 * Role distinguishes capability; MentorStudents links a student to their mentor(s).
 */
const userSchema = new Schema(
  {
    role: { type: String, enum: ALL_ROLES, required: true, default: ROLES.STUDENT },

    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    emailVerified: { type: Boolean, default: false },

    name: { type: String, trim: true, default: '' },
    avatar: { type: String, default: '' },

    status: { type: String, enum: ['active', 'banned'], default: 'active' },

    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.index({ role: 1 });
userSchema.index({ status: 1 });

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };

export const User = model('User', userSchema);
