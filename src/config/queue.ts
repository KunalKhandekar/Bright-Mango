import { Queue, QueueOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from './env.js';

/**
 * BullMQ requires a dedicated connection with `maxRetriesPerRequest: null`.
 * Workers (src/jobs/workers) create their own connections from this same URL.
 */
export const bullConnection = new Redis(env.redisUrl, {
  maxRetriesPerRequest: null,
});

export const QUEUE_NAMES = {
  EMAIL: 'email',
  COURSE_DELETE: 'course-delete',
  VIDEO_STATUS: 'video-status',
} as const;

const defaultOptions: QueueOptions = {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: 1_000,
    removeOnFail: 5_000,
  },
};

export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, defaultOptions);
export const courseDeleteQueue = new Queue(QUEUE_NAMES.COURSE_DELETE, defaultOptions);
export const videoStatusQueue = new Queue(QUEUE_NAMES.VIDEO_STATUS, defaultOptions);
