/**
 * Every transactional email process the platform sends. Each entry defines the
 * variables a template may use and the built-in default (the pre-customization
 * hardcoded email) used whenever no custom template is assigned to the process.
 */
export interface EmailProcessDef {
  label: string;
  description: string;
  variables: readonly string[];
  defaultSubject: string;
  defaultBody: string;
}

export const EMAIL_PROCESSES = {
  'login-otp': {
    label: 'Login OTP',
    description: 'Sent when a user requests a login code.',
    variables: ['otp', 'ttlMinutes'],
    defaultSubject: 'Your BrightMango login code',
    defaultBody: `<div style="font-family:sans-serif">
    <h2>Your BrightMango login code</h2>
    <p style="font-size:28px;letter-spacing:4px;font-weight:bold">{{otp}}</p>
    <p>This code expires in {{ttlMinutes}} minutes. If you didn't request it, ignore this email.</p>
  </div>`,
  },
  'deletion-otp': {
    label: 'Course deletion OTP',
    description: 'Sent to the mentor to confirm scheduling a course deletion.',
    variables: ['otp', 'ttlMinutes', 'courseTitle'],
    defaultSubject: 'Confirm deletion of {{courseTitle}}',
    defaultBody: `<div style="font-family:sans-serif">
    <h2>Confirm course deletion</h2>
    <p>Use this code to confirm scheduling <b>{{courseTitle}}</b> for deletion.</p>
    <p style="font-size:28px;letter-spacing:4px;font-weight:bold">{{otp}}</p>
    <p>This code expires in {{ttlMinutes}} minutes. If you didn't request it, ignore this email.</p>
  </div>`,
  },
  'manual-enroll': {
    label: 'Manual enrollment',
    description: 'Sent when a mentor grants a student access to a course.',
    variables: ['courseTitle', 'loginUrl'],
    defaultSubject: "You've been enrolled in {{courseTitle}}",
    defaultBody: `<p>You now have access to <b>{{courseTitle}}</b>. Log in here: <a href="{{loginUrl}}">{{loginUrl}}</a></p>`,
  },
  'comment-reply': {
    label: 'Comment reply',
    description: 'Sent when someone replies to a comment.',
    variables: ['replierName', 'lessonTitle', 'replyExcerpt', 'lessonUrl'],
    defaultSubject: '{{replierName}} replied to your BrightMango comment',
    defaultBody: `<div style="font-family:sans-serif">
    <h2>{{replierName}} replied to your comment</h2>
    <p>Your discussion in <b>{{lessonTitle}}</b> has a new reply.</p>
    <blockquote style="border-left:3px solid #ddd;margin:16px 0;padding-left:12px;color:#444">{{replyExcerpt}}</blockquote>
    <p><a href="{{lessonUrl}}">Open the lesson discussion</a></p>
  </div>`,
  },
  campaign: {
    label: 'Campaign default',
    description: 'Prefills the campaign composer; campaigns still send whatever the composer contains.',
    variables: ['name', 'email'],
    defaultSubject: '',
    defaultBody: '',
  },
} as const satisfies Record<string, EmailProcessDef>;

export type EmailProcessKey = keyof typeof EMAIL_PROCESSES;

export const EMAIL_PROCESS_KEYS = Object.keys(EMAIL_PROCESSES) as EmailProcessKey[];

export function isEmailProcessKey(value: string): value is EmailProcessKey {
  return value in EMAIL_PROCESSES;
}
