import { Worker, UnrecoverableError } from 'bullmq';
import { bullConnection, QUEUE_NAMES } from '../../config/queue.js';
import { logger } from '../../common/utils/logger.js';
import { getVideoStatus } from '../../integrations/stream.service.js';
import { applyVideoStatus, markVideoError } from '../../modules/lesson/lesson.service.js';

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
      if (status.errored) {
        // Terminal encode failure — stop retrying and surface it on the lesson.
        await markVideoError(lessonId, uid);
        throw new UnrecoverableError(`video ${uid} failed to encode: ${status.errorReason ?? 'unknown'}`);
      }
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
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (err instanceof UnrecoverableError || exhausted) {
      // Never strand the lesson in 'processing' — the upload likely never
      // completed (or encoding died), so flip it to 'error'.
      logger.error(
        { jobId: job.id, lessonId: job.data.lessonId, uid: job.data.uid, err: err.message },
        '[videoStatus.worker] gave up — marking lesson video errored',
      );
      void markVideoError(job.data.lessonId, job.data.uid).catch((markErr) =>
        logger.error({ err: markErr }, '[videoStatus.worker] failed to mark lesson errored'),
      );
    }
  });
  return worker;
}
