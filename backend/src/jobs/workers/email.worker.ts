import { Worker } from 'bullmq';
import { bullConnection, QUEUE_NAMES } from '../../config/queue.js';
import { logger } from '../../common/utils/logger.js';
import { sendMail } from '../../integrations/mailer.service.js';
import { incrementSent, dispatchCampaign } from '../../modules/email/email.service.js';
import { renderEmailForProcess } from '../../modules/emailTemplate/emailTemplate.service.js';
import type { EmailJob } from '../queues.js';

export function startEmailWorker(): Worker {
  const worker = new Worker<EmailJob>(
    QUEUE_NAMES.EMAIL,
    async (job) => {
      const data = job.data;
      switch (data.type) {
        case 'login-otp':
          await sendMail({
            to: data.to,
            ...(await renderEmailForProcess('login-otp', {
              otp: data.otp,
              ttlMinutes: String(data.ttlMinutes),
            })),
          });
          break;
        case 'deletion-otp':
          await sendMail({
            to: data.to,
            ...(await renderEmailForProcess('deletion-otp', {
              otp: data.otp,
              ttlMinutes: String(data.ttlMinutes),
              courseTitle: data.courseTitle,
            })),
          });
          break;
        case 'manual-enroll':
          await sendMail({
            to: data.to,
            ...(await renderEmailForProcess('manual-enroll', {
              courseTitle: data.courseTitle,
              loginUrl: data.loginUrl,
            })),
          });
          break;
        case 'comment-reply':
          await sendMail({
            to: data.to,
            ...(await renderEmailForProcess('comment-reply', {
              replierName: data.replierName,
              lessonTitle: data.lessonTitle,
              replyExcerpt: data.replyExcerpt,
              lessonUrl: data.lessonUrl,
            })),
          });
          break;
        case 'campaign':
          await sendMail({ to: data.to, subject: data.subject, html: data.html });
          await incrementSent(data.campaignId);
          break;
        case 'campaign-dispatch':
          await dispatchCampaign(data.campaignId);
          break;
      }
    },
    { connection: bullConnection, concurrency: 10 },
  );

  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id }, '[email.worker] failed'));
  return worker;
}
