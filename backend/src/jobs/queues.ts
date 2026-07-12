import { emailQueue, courseDeleteQueue, videoStatusQueue } from '../config/queue.js';

/** Job name → payload contracts for the email queue. */
export type EmailJob =
  | { type: 'login-otp'; to: string; otp: string; ttlMinutes: number }
  | { type: 'deletion-otp'; to: string; otp: string; ttlMinutes: number; courseTitle: string }
  | { type: 'manual-enroll'; to: string; courseTitle: string; loginUrl: string }
  | {
      type: 'comment-reply';
      to: string;
      replierName: string;
      lessonTitle: string;
      replyExcerpt: string;
      lessonUrl: string;
    }
  | {
      type: 'campaign';
      to: string;
      subject: string;
      html: string;
      campaignId: string;
    }
  | { type: 'campaign-dispatch'; campaignId: string };

export async function enqueueEmail(job: EmailJob): Promise<void> {
  await emailQueue.add(job.type, job);
}

/** Schedule a campaign dispatch for later (delayed job). Returns job id for cancellation. */
export async function enqueueCampaignDispatch(campaignId: string, delayMs: number): Promise<string> {
  const job = await emailQueue.add(
    'campaign-dispatch',
    { type: 'campaign-dispatch', campaignId } satisfies EmailJob,
    { delay: delayMs },
  );
  return job.id!;
}

/** Remove a scheduled campaign dispatch job (cancellation). Idempotent. */
export async function removeCampaignDispatch(jobId: string): Promise<void> {
  const job = await emailQueue.getJob(jobId);
  if (job) await job.remove();
}

/** Schedule a delayed course hard-delete (OTP-protected deletion request). Returns job id. */
export async function enqueueCourseDeletion(courseId: string, delayMs: number): Promise<string> {
  const job = await courseDeleteQueue.add('delete', { courseId }, { delay: delayMs });
  return job.id!;
}

/** Remove a scheduled course deletion job (cancellation). Idempotent. */
export async function removeCourseDeletion(jobId: string): Promise<void> {
  const job = await courseDeleteQueue.getJob(jobId);
  if (job) await job.remove();
}

/** Poll Cloudflare Stream encode status for a lesson until ready. */
export async function enqueueVideoStatusPoll(lessonId: string, uid: string): Promise<void> {
  await videoStatusQueue.add(
    'poll',
    { lessonId, uid },
    { attempts: 20, backoff: { type: 'fixed', delay: 15_000 } },
  );
}
