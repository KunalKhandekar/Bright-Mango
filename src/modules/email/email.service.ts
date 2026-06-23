import { Types } from 'mongoose';
import { EmailCampaign, EmailCampaignDoc } from './emailCampaign.model.js';
import { MentorStudent } from '../user/mentorStudent.model.js';
import { User } from '../user/user.model.js';
import { EmailBlacklist } from '../user/emailBlacklist.model.js';
import { enqueueEmail } from '../../jobs/queues.js';
import { auditLog } from '../audit/audit.service.js';
import { PaginationParams } from '../../common/utils/pagination.util.js';
import { logger } from '../../common/utils/logger.js';

/** Interpolate {{name}} / {{email}} tokens; unknown tokens are stripped. */
function interpolate(template: string, fields: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => fields[key] ?? '');
}

/**
 * Create a campaign and fan out one email job per eligible recipient (the mentor's
 * students, excluding banned + blacklisted). sentCount is advanced by the email worker.
 */
export async function createCampaign(
  mentorId: string,
  subject: string,
  body: string,
): Promise<EmailCampaignDoc> {
  const links = await MentorStudent.find({ mentorId }).select('studentId').lean();
  const studentIds = links.map((l) => l.studentId);

  const [students, blacklisted] = await Promise.all([
    User.find({ _id: { $in: studentIds }, status: 'active' }).select('name email').lean(),
    EmailBlacklist.find({}).select('email').lean(),
  ]);
  const blockedEmails = new Set(blacklisted.map((b) => b.email));
  const recipients = students.filter((s) => !blockedEmails.has(s.email));

  const campaign = await EmailCampaign.create({
    mentorId,
    subject,
    body,
    totalRecipients: recipients.length,
    sentCount: 0,
    status: recipients.length > 0 ? 'sending' : 'completed',
  });

  // Fan-out — one job per recipient with per-recipient interpolation.
  await Promise.all(
    recipients.map((r) =>
      enqueueEmail({
        type: 'campaign',
        to: r.email,
        subject: interpolate(subject, { name: r.name ?? '', email: r.email }),
        html: interpolate(body, { name: r.name ?? '', email: r.email }),
        campaignId: campaign._id.toString(),
      }),
    ),
  ).catch((err) => logger.error({ err, campaignId: campaign._id }, '[campaign] fan-out failed'));

  auditLog({ userId: mentorId, action: 'CAMPAIGN_SENT', entityType: 'EmailCampaign', entityId: campaign._id });
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
