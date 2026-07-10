import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from '../common/utils/logger.js';

/**
 * Single shared Redis client for app-level use (sessions, OTP, rate limiting).
 * BullMQ uses its own connection (see config/queue.ts) because it requires
 * `maxRetriesPerRequest: null`.
 */
export const redis = new Redis(env.redisUrl, {
  lazyConnect: false,
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => logger.info('[redis] connected'));
redis.on('error', (err) => logger.error({ err }, '[redis] error'));

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}
