import { Types } from 'mongoose';
import { EmailCampaign, EmailCampaignDoc } from './emailCampaign.model.js';
import { MentorStudent } from '../user/mentorStudent.model.js';
import { User } from '../user/user.model.js';
import { EmailBlacklist } from '../user/emailBlacklist.model.js';
import { Enrollment } from '../enrollment/enrollment.model.js';
import { assertCourseOwner } from '../course/course.service.js';
import { enqueueEmail, enqueueCampaignDispatch, removeCampaignDispatch } from '../../jobs/queues.js';
import { auditLog } from '../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import { ApiError } from '../../common/http/ApiError.js';
import { PaginationParams } from '../../common/utils/pagination.util.js';
import { logger } from '../../common/utils/logger.js';
import { interpolate } from '../../common/utils/template.util.js';

export interface CampaignAudience {
  type: 'all' | 'course' | 'students';
  courseId?: string;
  studentIds?: string[];
}

interface Recipient {
  name?: string;
  email: string;
}

/**
 * Resolve the audience to concrete recipients. All modes are restricted to the
 * mentor's own active students and exclude blacklisted emails.
 */
async function resolveRecipients(
  mentorId: string,
  audience: CampaignAudience,
): Promise<Recipient[]> {
  let candidateIds: Types.ObjectId[];
  if (audience.type === 'course') {
    if (!audience.courseId) return [];
    await assertCourseOwner(audience.courseId, mentorId);
    const enrollments = await Enrollment.find({ courseId: audience.courseId })
      .select('studentId')
      .lean();
    candidateIds = enrollments.map((e) => e.studentId);
  } else {
    const links = await MentorStudent.find({ mentorId }).select('studentId').lean();
    candidateIds = links.map((l) => l.studentId);
    if (audience.type === 'students') {
      const selected = new Set((audience.studentIds ?? []).map(String));
      candidateIds = candidateIds.filter((id) => selected.has(id.toString()));
    }
  }

  const [students, blacklisted] = await Promise.all([
    User.find({ _id: { $in: candidateIds }, status: 'active' }).select('name email').lean(),
    EmailBlacklist.find({}).select('email').lean(),
  ]);
  const blockedEmails = new Set(blacklisted.map((b) => b.email));
  return students.filter((s) => !blockedEmails.has(s.email));
}

/**
 * Move a campaign into 'sending' and fan out one email job per recipient.
 * The atomic status guard makes this safe against cancel/duplicate-dispatch
 * races — whichever side flips the status first wins. Recipients are resolved
 * fresh at dispatch time so scheduled campaigns pick up audience changes.
 */
export async function dispatchCampaign(campaignId: string): Promise<void> {
  const campaign = await EmailCampaign.findOneAndUpdate(
    { _id: campaignId, status: { $in: ['pending', 'scheduled'] } },
    { $set: { status: 'sending' } },
    { new: true },
  );
  if (!campaign) return; // cancelled or already dispatched

  const audience = (campaign.audience ?? { type: 'all' }) as CampaignAudience;
  const recipients = await resolveRecipients(campaign.mentorId.toString(), {
    type: audience.type,
    courseId: audience.courseId?.toString(),
    studentIds: audience.studentIds?.map(String),
  });

  campaign.totalRecipients = recipients.length;
  if (recipients.length === 0) campaign.status = 'completed';
  await campaign.save();
  if (recipients.length === 0) return;

  // Fan-out — one job per recipient with per-recipient interpolation.
  await Promise.all(
    recipients.map((r) =>
      enqueueEmail({
        type: 'campaign',
        to: r.email,
        subject: interpolate(campaign.subject, { name: r.name ?? '', email: r.email }, { escape: false }),
        html: interpolate(campaign.body, { name: r.name ?? '', email: r.email }, { escape: false }),
        campaignId: campaign._id.toString(),
      }),
    ),
  ).catch((err) => logger.error({ err, campaignId: campaign._id }, '[campaign] fan-out failed'));
}

/**
 * Create a campaign. Without scheduledFor it dispatches immediately; with a
 * future scheduledFor it is queued as a BullMQ delayed job and can be cancelled
 * until it fires. sentCount is advanced by the email worker.
 */
export async function createCampaign(
  mentorId: string,
  input: {
    subject: string;
    body: string;
    audience?: CampaignAudience;
    scheduledFor?: Date;
  },
): Promise<EmailCampaignDoc> {
  const audience: CampaignAudience = input.audience ?? { type: 'all' };

  // Resolve once up front: validates course ownership and gives the UI a
  // recipient-count preview. Scheduled sends re-resolve at dispatch time.
  const recipients = await resolveRecipients(mentorId, audience);

  if (input.scheduledFor) {
    const delayMs = input.scheduledFor.getTime() - Date.now();
    if (delayMs <= 0) {
      throw ApiError.badRequest('VALIDATION_ERROR', 'Scheduled time must be in the future');
    }
    const campaign = await EmailCampaign.create({
      mentorId,
      subject: input.subject,
      body: input.body,
      audience,
      totalRecipients: recipients.length,
      sentCount: 0,
      status: 'scheduled',
      scheduledFor: input.scheduledFor,
    });
    campaign.scheduleJobId = await enqueueCampaignDispatch(campaign._id.toString(), delayMs);
    await campaign.save();
    auditLog({
      userId: mentorId,
      action: AUDIT_ACTIONS.CAMPAIGN_SCHEDULED,
      entityType: 'EmailCampaign',
      entityId: campaign._id,
      metadata: { scheduledFor: input.scheduledFor, audienceType: audience.type },
    });
    return campaign.toObject() as EmailCampaignDoc;
  }

  const campaign = await EmailCampaign.create({
    mentorId,
    subject: input.subject,
    body: input.body,
    audience,
    totalRecipients: recipients.length,
    sentCount: 0,
    status: 'pending',
  });
  await dispatchCampaign(campaign._id.toString());
  auditLog({
    userId: mentorId,
    action: AUDIT_ACTIONS.CAMPAIGN_SENT,
    entityType: 'EmailCampaign',
    entityId: campaign._id,
    metadata: { audienceType: audience.type },
  });
  const fresh = await EmailCampaign.findById(campaign._id).lean<EmailCampaignDoc>();
  return fresh ?? (campaign.toObject() as EmailCampaignDoc);
}

/** Cancel a scheduled campaign before it fires. */
export async function cancelCampaign(campaignId: string, mentorId: string): Promise<EmailCampaignDoc> {
  const campaign = await EmailCampaign.findOneAndUpdate(
    { _id: new Types.ObjectId(campaignId), mentorId, status: 'scheduled' },
    { $set: { status: 'cancelled' } },
    { new: true },
  );
  if (!campaign) {
    throw ApiError.notFound('No scheduled campaign to cancel');
  }
  // Best-effort job removal — if the job already went active, the status guard
  // in dispatchCampaign is what actually prevents the send.
  if (campaign.scheduleJobId) {
    try {
      await removeCampaignDispatch(campaign.scheduleJobId);
    } catch (err) {
      logger.warn({ err, campaignId }, '[campaign] failed to remove scheduled job');
    }
  }
  auditLog({
    userId: mentorId,
    action: AUDIT_ACTIONS.CAMPAIGN_CANCELLED,
    entityType: 'EmailCampaign',
    entityId: campaign._id,
  });
  return campaign.toObject() as EmailCampaignDoc;
}

/** Called by the email worker after each campaign email is delivered. */
export async function incrementSent(campaignId: string): Promise<void> {
  const campaign = await EmailCampaign.findByIdAndUpdate(
    campaignId,
    { $inc: { sentCount: 1 } },
    { new: true },
  );
  if (campaign && campaign.sentCount >= campaign.totalRecipients) {
    campaign.status = 'completed';
    await campaign.save();
  }
}

export async function listCampaigns(
  mentorId: string,
  pagination: PaginationParams,
): Promise<{ items: EmailCampaignDoc[]; total: number }> {
  const [items, total] = await Promise.all([
    EmailCampaign.find({ mentorId })
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean<EmailCampaignDoc[]>(),
    EmailCampaign.countDocuments({ mentorId }),
  ]);
  return { items, total };
}

export async function getCampaign(campaignId: string, mentorId: string): Promise<EmailCampaignDoc | null> {
  return EmailCampaign.findOne({ _id: new Types.ObjectId(campaignId), mentorId }).lean<EmailCampaignDoc>();
}
