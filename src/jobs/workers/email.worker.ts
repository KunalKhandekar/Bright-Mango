import { Worker } from 'bullmq';
import { bullConnection, QUEUE_NAMES } from '../../config/queue.js';
import { logger } from '../../common/utils/logger.js';
import { sendMail } from '../../integrations/mailer.service.js';
import { incrementSent } from '../../modules/email/email.service.js';
import type { EmailJob } from '../queues.js';

function otpTemplate(otp: string, ttlMinutes: number): string {
  return `<div style="font-family:sans-serif">
    <h2>Your BrightMango login code</h2>
    <p style="font-size:28px;letter-spacing:4px;font-weight:bold">${otp}</p>
    <p>This code expires in ${ttlMinutes} minutes. If you didn't request it, ignore this email.</p>
  </div>`;
}

export function startEmailWorker(): Worker {
  const worker = new Worker<EmailJob>(
    QUEUE_NAMES.EMAIL,
    async (job) => {
      const data = job.data;
      switch (data.type) {
        case 'otp':
          await sendMail({
            to: data.to,
            subject: 'Your BrightMango login code',
            html: otpTemplate(data.otp, data.ttlMinutes),
          });
          break;
        case 'manual-enroll':
          await sendMail({
            to: data.to,
            subject: `You've been enrolled in ${data.courseTitle}`,
            html: `<p>You now have access to <b>${data.courseTitle}</b>. Log in here: <a href="${data.loginUrl}">${data.loginUrl}</a></p>`,
          });
          break;
        case 'campaign':
          await sendMail({ to: data.to, subject: data.subject, html: data.html });
          await incrementSent(data.campaignId);
          break;
      }
    },
    { connection: bullConnection, concurrency: 10 },
  );

  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id }, '[email.worker] failed'));
  return worker;
}
