import { Role } from '../../common/constants/roles.js';
import { RequestContext } from '../../common/types/common.types.js';

export interface ActiveSessionView {
  sessionId: string;
  deviceName: string;
  userAgent: string;
  ipAddress: string;
  lastSeenAt: Date | null;
  current: boolean;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
  role: Role;
  emailVerified: boolean;
  status: string;
}

export interface SessionCreateResult {
  sessionId: string;
  deviceId: string;
}

/** Outcome of verifyOtp — either a session is issued, or the session limit blocks it. */
export type VerifyOtpResult =
  | { kind: 'session'; user: PublicUser; session: SessionCreateResult }
  | { kind: 'session_limit'; activeSessions: ActiveSessionView[] };

export type { RequestContext };
