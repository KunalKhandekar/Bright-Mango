import { Role } from '../constants/roles.js';

/** Attached to authenticated requests by the `authenticate` middleware. */
export interface AuthContext {
  sessionId: string;
  userId: string;
  role: Role;
  deviceId: string;
}

/** Request-scoped context derived for auth/session services (ip, ua, device). */
export interface RequestContext {
  ip: string;
  userAgent: string;
  deviceId?: string;
  deviceName?: string;
}
