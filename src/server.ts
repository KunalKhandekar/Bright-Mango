import { Server } from 'node:http';
import { Worker } from 'bullmq';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { disconnectRedis } from './config/redis.js';
import { startWorkers } from './jobs/index.js';
import { logger } from './common/utils/logger.js';

async function bootstrap(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  const workers: Worker[] = startWorkers();

  const server: Server = app.listen(env.port, () => {
    logger.info(`[server] listening on :${env.port}${env.apiPrefix} (${env.nodeEnv})`);
  });

  async function shutdown(signal: string): Promise<void> {
    logger.info(`[server] ${signal} received, shutting down`);
    server.close();
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
  logger.error({ err }, '[server] failed to start');
  process.exit(1);
});
