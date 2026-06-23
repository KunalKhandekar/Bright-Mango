import { Worker } from 'bullmq';
import { startEmailWorker } from './workers/email.worker.js';
import { startCourseDeleteWorker } from './workers/courseDelete.worker.js';
import { startVideoStatusWorker } from './workers/videoStatus.worker.js';
import { logger } from '../common/utils/logger.js';

/**
 * Start all background workers. Returns the worker handles so the server can close them
 * gracefully on shutdown.
 */
export function startWorkers(): Worker[] {
  const workers = [startEmailWorker(), startCourseDeleteWorker(), startVideoStatusWorker()];
  logger.info(`[jobs] started ${workers.length} worker(s)`);
  return workers;
}
