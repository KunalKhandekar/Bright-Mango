import { Types } from 'mongoose';
import { redis } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { redisKeys } from '../../common/constants/redisKeys.js';
import { generateSessionId } from '../../common/utils/crypto.util.js';
import { ROLES, Role } from '../../common/constants/roles.js';
import { RequestContext } from '../../common/types/common.types.js';
import { UserSession } from './userSession.model.js';
import { ActiveSessionView } from './auth.types.js';

interface StoredSession {
  userId: string;
  role: Role;
  deviceId: string;
  ip: string;
  userAgent: string;
  createdAt: string;
}

/** How many concurrent sessions a role may hold. Mentors are effectively uncapped. */
function maxSessionsFor(role: Role): number {
  return role === ROLES.STUDENT ? env.studentMaxSessions : 1_000;
}

/**
 * Returns the user's currently-valid session ids, pruning any that have expired in Redis
 * but linger in the `user_sessions` set (self-healing).
 */
async function getValidSessionIds(userId: string): Promise<string[]> {
  const setKey = redisKeys.userSessions(userId);
  const ids = await redis.smembers(setKey);
  if (ids.length === 0) return [];

  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.exists(redisKeys.session(id)));
  const results = await pipeline.exec();

  const valid: string[] = [];
  const stale: string[] = [];
  ids.forEach((id, i) => {
    const exists = results?.[i]?.[1] === 1;
    if (exists) valid.push(id);
    else stale.push(id);
  });

  if (stale.length > 0) {
    await redis.srem(setKey, ...stale);
    await UserSession.updateMany(
      { sessionId: { $in: stale }, isActive: true },
      { $set: { isActive: false, revokedAt: new Date() } },
    );
  }

  return valid;
}

/** Whether creating a new session would exceed the role's limit. */
export async function isSessionLimitReached(userId: string, role: Role): Promise<boolean> {
  const valid = await getValidSessionIds(userId);
  return valid.length >= maxSessionsFor(role);
}

/** Create a Redis session + persist a UserSession analytics record. */
export async function createSession(
  userId: Types.ObjectId,
  role: Role,
  ctx: RequestContext,
): Promise<{ sessionId: string; deviceId: string }> {
  const sessionId = generateSessionId();
  const deviceId = ctx.deviceId ?? generateSessionId().slice(0, 32);

  const payload: StoredSession = {
    userId: userId.toString(),
    role,
    deviceId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    createdAt: new Date().toISOString(),
  };

  await redis
    .multi()
    .set(redisKeys.session(sessionId), JSON.stringify(payload), 'EX', env.sessionTtlSeconds)
    .sadd(redisKeys.userSessions(userId.toString()), sessionId)
    .exec();

  await UserSession.create({
    sessionId,
    userId,
    deviceId,
    deviceName: ctx.deviceName ?? '',
    userAgent: ctx.userAgent,
    ipAddress: ctx.ip,
    isActive: true,
    lastSeenAt: new Date(),
  });

  return { sessionId, deviceId };
}

/** List the user's active sessions for display (marks which one is the caller's). */
export async function getActiveSessions(
  userId: string,
  currentSessionId?: string,
): Promise<ActiveSessionView[]> {
  const validIds = await getValidSessionIds(userId);
  if (validIds.length === 0) return [];

  const docs = await UserSession.find({ sessionId: { $in: validIds } })
    .sort({ lastSeenAt: -1 })
    .lean();

  return docs.map((d) => ({
    sessionId: d.sessionId,
    deviceName: d.deviceName ?? '',
    userAgent: d.userAgent ?? '',
    ipAddress: d.ipAddress ?? '',
    lastSeenAt: d.lastSeenAt ?? null,
    current: d.sessionId === currentSessionId,
  }));
}

/** Update lastSeenAt + slide the Redis TTL (heartbeat). */
export async function touchSession(sessionId: string): Promise<void> {
  await redis.expire(redisKeys.session(sessionId), env.sessionTtlSeconds);
  await UserSession.updateOne({ sessionId }, { $set: { lastSeenAt: new Date() } });
}

/** Revoke a single session — idempotent. Optionally scope to a user for authz safety. */
export async function revokeSession(sessionId: string, userId?: string): Promise<void> {
  await redis.del(redisKeys.session(sessionId));
  if (userId) {
    await redis.srem(redisKeys.userSessions(userId), sessionId);
  } else {
    const raw = await UserSession.findOne({ sessionId }).lean();
    if (raw) await redis.srem(redisKeys.userSessions(raw.userId.toString()), sessionId);
  }
  await UserSession.updateOne(
    { sessionId, isActive: true },
    { $set: { isActive: false, revokedAt: new Date() } },
  );
}

/** Destroy every session for a user (logout-all / mentor force-logout). */
export async function destroyAllSessions(userId: string): Promise<number> {
  const ids = await redis.smembers(redisKeys.userSessions(userId));
  if (ids.length > 0) {
    const pipeline = redis.pipeline();
    ids.forEach((id) => pipeline.del(redisKeys.session(id)));
    pipeline.del(redisKeys.userSessions(userId));
    await pipeline.exec();
  } else {
    await redis.del(redisKeys.userSessions(userId));
  }
  await UserSession.updateMany(
    { userId, isActive: true },
    { $set: { isActive: false, revokedAt: new Date() } },
  );
  return ids.length;
}

/** Confirm a session id belongs to the given user (used before mentor revokes one). */
export async function sessionBelongsToUser(sessionId: string, userId: string): Promise<boolean> {
  return (await redis.sismember(redisKeys.userSessions(userId), sessionId)) === 1;
}

// ── Trusted device ────────────────────────────────────────────────────────────

export async function markTrustedDevice(userId: string, deviceId: string): Promise<void> {
  await redis.set(
    redisKeys.trustedDevice(userId, deviceId),
    '1',
    'EX',
    env.trustedDeviceTtlSeconds,
  );
}

export async function isTrustedDevice(userId: string, deviceId: string): Promise<boolean> {
  return (await redis.exists(redisKeys.trustedDevice(userId, deviceId))) === 1;
}
