import { Worker, UnrecoverableError } from 'bullmq';
import { bullConnection, QUEUE_NAMES } from '../../config/queue.js';
import { logger } from '../../common/utils/logger.js';
import { getVideoStatus } from '../../integrations/stream.service.js';
import { applyVideoStatus } from '../../modules/lesson/lesson.service.js';

interface VideoStatusJob {
  lessonId: string;
  uid: string;
}

/**
 * Polls Cloudflare Stream until the video is ready, then writes playbackId + duration
 * onto the lesson. If not ready, throws so BullMQ retries with backoff (bounded attempts).
 */
export function startVideoStatusWorker(): Worker<VideoStatusJob> {
  const worker = new Worker<VideoStatusJob>(
    QUEUE_NAMES.VIDEO_STATUS,
    async (job) => {
      const { lessonId, uid } = job.data;
      const status = await getVideoStatus(uid);
      if (!status.ready) {
        // Retry via backoff until attempts exhausted.
        throw new Error(`video ${uid} not ready yet`);
      }
      await applyVideoStatus(lessonId, status);
      logger.info({ lessonId, uid }, '[videoStatus] lesson video ready');
    },
    { connection: bullConnection, concurrency: 5 },
  );

  worker.on('failed', (job, err) => {
    if (err instanceof UnrecoverableError) {
      logger.error({ jobId: job?.id }, '[videoStatus.worker] gave up');
    }
  });
  return worker;
}
