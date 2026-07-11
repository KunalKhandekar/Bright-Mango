import { Worker } from 'bullmq';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { disconnectRedis } from './config/redis.js';
import { startWorkers } from './jobs/index.js';
import { logger } from './common/utils/logger.js';

async function bootstrap(): Promise<void> {
  await connectDatabase();
  const workers: Worker[] = startWorkers();
  logger.info(`[worker] ${workers.length} worker(s) running`);

  async function shutdown(signal: string): Promise<void> {
    logger.info(`[worker] ${signal} received, shutting down`);
    await Promise.allSettled(workers.map((w) => w.close()));
    await disconnectDatabase();
    await disconnectRedis();
    process.exit(0);
  }

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
}

bootstrap().catch((err) => {
  logger.error({ err }, '[worker] failed to start');
  process.exit(1);
});