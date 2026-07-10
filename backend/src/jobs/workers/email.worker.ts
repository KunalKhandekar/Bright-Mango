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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function commentReplyTemplate(input: {
  replierName: string;
  lessonTitle: string;
  replyExcerpt: string;
  lessonUrl: string;
}): string {
  const replierName = escapeHtml(input.replierName);
  const lessonTitle = escapeHtml(input.lessonTitle);
  const replyExcerpt = escapeHtml(input.replyExcerpt);
  const lessonUrl = escapeHtml(input.lessonUrl);

  return `<div style="font-family:sans-serif">
    <h2>${replierName} replied to your comment</h2>
    <p>Your discussion in <b>${lessonTitle}</b> has a new reply.</p>
    <blockquote style="border-left:3px solid #ddd;margin:16px 0;padding-left:12px;color:#444">${replyExcerpt}</blockquote>
    <p><a href="${lessonUrl}">Open the lesson discussion</a></p>
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
        case 'comment-reply':
          await sendMail({
            to: data.to,
            subject: `${data.replierName} replied to your BrightMango comment`,
            html: commentReplyTemplate(data),
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
