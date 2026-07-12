import { ApiError } from '../../common/http/ApiError.js';
import { ErrorCode } from '../../common/http/errorCodes.js';
import { PaginationParams } from '../../common/utils/pagination.util.js';
import { extractTokens, interpolate } from '../../common/utils/template.util.js';
import { auditLog } from '../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import { EmailTemplate, EmailTemplateDoc } from './emailTemplate.model.js';
import { EMAIL_PROCESSES, EmailProcessKey, isEmailProcessKey } from './emailTemplate.constants.js';

/** Reject templates whose tokens aren't available for the target process. */
function assertTokensAllowed(processKey: EmailProcessKey, subject: string, body: string): void {
  const allowed = new Set<string>(EMAIL_PROCESSES[processKey].variables);
  const used = [...new Set([...extractTokens(subject), ...extractTokens(body)])];
  const unknown = used.filter((t) => !allowed.has(t));
  if (unknown.length > 0) {
    throw ApiError.badRequest(
      ErrorCode.VALIDATION_ERROR,
      `Template uses variables not available for ${EMAIL_PROCESSES[processKey].label}: ${unknown.join(', ')}`,
    );
  }
}

export async function createTemplate(
  mentorId: string,
  input: { name: string; subject: string; body: string },
): Promise<EmailTemplateDoc> {
  const existing = await EmailTemplate.findOne({ name: input.name }).lean();
  if (existing) throw ApiError.conflict(ErrorCode.CONFLICT, 'A template with this name already exists');

  const template = await EmailTemplate.create(input);
  auditLog({
    userId: mentorId,
    action: AUDIT_ACTIONS.EMAIL_TEMPLATE_CREATED,
    entityType: 'EmailTemplate',
    entityId: template._id,
    metadata: { name: template.name },
  });
  return template.toObject() as EmailTemplateDoc;
}

export async function updateTemplate(
  templateId: string,
  mentorId: string,
  input: Partial<{ name: string; subject: string; body: string }>,
): Promise<EmailTemplateDoc> {
  const template = await EmailTemplate.findById(templateId);
  if (!template) throw ApiError.notFound('Template not found');

  if (input.name && input.name !== template.name) {
    const clash = await EmailTemplate.findOne({ name: input.name, _id: { $ne: template._id } }).lean();
    if (clash) throw ApiError.conflict(ErrorCode.CONFLICT, 'A template with this name already exists');
  }

  if (input.name !== undefined) template.name = input.name;
  if (input.subject !== undefined) template.subject = input.subject;
  if (input.body !== undefined) template.body = input.body;

  // A template already serving a process must stay within that process's variables.
  if (template.processKey && isEmailProcessKey(template.processKey)) {
    assertTokensAllowed(template.processKey, template.subject, template.body);
  }

  await template.save();
  invalidateTemplateCache();
  auditLog({
    userId: mentorId,
    action: AUDIT_ACTIONS.EMAIL_TEMPLATE_UPDATED,
    entityType: 'EmailTemplate',
    entityId: template._id,
    metadata: { name: template.name },
  });
  return template.toObject() as EmailTemplateDoc;
}

export async function deleteTemplate(templateId: string, mentorId: string): Promise<void> {
  const template = await EmailTemplate.findByIdAndDelete(templateId);
  if (!template) throw ApiError.notFound('Template not found');
  invalidateTemplateCache();
  auditLog({
    userId: mentorId,
    action: AUDIT_ACTIONS.EMAIL_TEMPLATE_DELETED,
    entityType: 'EmailTemplate',
    entityId: template._id,
    metadata: { name: template.name, processKey: template.processKey ?? null },
  });
}

export async function getTemplate(templateId: string): Promise<EmailTemplateDoc> {
  const template = await EmailTemplate.findById(templateId).lean<EmailTemplateDoc>();
  if (!template) throw ApiError.notFound('Template not found');
  return template;
}

export async function listTemplates(
  pagination: PaginationParams,
): Promise<{ items: EmailTemplateDoc[]; total: number }> {
  const [items, total] = await Promise.all([
    EmailTemplate.find({})
      .sort({ updatedAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean<EmailTemplateDoc[]>(),
    EmailTemplate.countDocuments({}),
  ]);
  return { items, total };
}

/** Processes with their variable whitelists, defaults and current assignment. */
export async function listProcesses() {
  const assigned = await EmailTemplate.find({ processKey: { $exists: true } })
    .select('processKey name')
    .lean();
  const byKey = new Map(assigned.map((t) => [t.processKey as string, t]));
  return Object.entries(EMAIL_PROCESSES).map(([key, def]) => ({
    key,
    label: def.label,
    description: def.description,
    variables: def.variables,
    defaultSubject: def.defaultSubject,
    defaultBody: def.defaultBody,
    assignedTemplateId: byKey.get(key)?._id ?? null,
    assignedTemplateName: byKey.get(key)?.name ?? null,
  }));
}

/** Assign a template to a process (templateId=null resets to the built-in default). */
export async function assignToProcess(
  mentorId: string,
  processKey: EmailProcessKey,
  templateId: string | null,
): Promise<void> {
  if (templateId) {
    const template = await EmailTemplate.findById(templateId);
    if (!template) throw ApiError.notFound('Template not found');
    assertTokensAllowed(processKey, template.subject, template.body);
    // One template per process, one process per template: clear both sides first.
    await EmailTemplate.updateMany({ processKey }, { $unset: { processKey: 1 } });
    template.processKey = processKey;
    await template.save();
  } else {
    await EmailTemplate.updateMany({ processKey }, { $unset: { processKey: 1 } });
  }
  invalidateTemplateCache();
  auditLog({
    userId: mentorId,
    action: AUDIT_ACTIONS.EMAIL_TEMPLATE_ASSIGNED,
    entityType: 'EmailTemplate',
    metadata: { processKey, templateId },
  });
}

// ── Send-time resolution (used by the email worker) ─────────────────────────────
// The worker runs in a separate process with its own DB connection; a short TTL
// cache keeps campaign fan-outs from hitting Mongo once per recipient.

const CACHE_TTL_MS = 60_000;
const cache = new Map<EmailProcessKey, { value: { subject: string; body: string }; expiresAt: number }>();

function invalidateTemplateCache(): void {
  cache.clear();
}

export async function resolveProcessTemplate(
  processKey: EmailProcessKey,
): Promise<{ subject: string; body: string }> {
  const hit = cache.get(processKey);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const custom = await EmailTemplate.findOne({ processKey }).select('subject body').lean();
  const def = EMAIL_PROCESSES[processKey];
  const value = custom
    ? { subject: custom.subject, body: custom.body }
    : { subject: def.defaultSubject, body: def.defaultBody };

  cache.set(processKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/** Resolve the process's template and interpolate variables (HTML-escaped). */
export async function renderEmailForProcess(
  processKey: EmailProcessKey,
  variables: Record<string, string>,
): Promise<{ subject: string; html: string }> {
  const { subject, body } = await resolveProcessTemplate(processKey);
  return {
    subject: interpolate(subject, variables),
    html: interpolate(body, variables),
  };
}
