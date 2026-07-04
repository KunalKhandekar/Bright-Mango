import { Resend } from 'resend';
import { env } from '../config/env.js';
import { logger } from '../common/utils/logger.js';

let resend: Resend | null = null;

function getResend(): Resend {
  if (resend) return resend;

  resend = new Resend(env.resend.apiKey);

  return resend;
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Low-level email sender.
 *
 * In development without Resend configured, logs the email instead of
 * sending so the OTP flow remains testable without an email provider.
 */
export async function sendMail(
  input: SendMailInput,
): Promise<void> {
  if (!env.resend.apiKey) {
    logger.info(
      {
        to: input.to,
        subject: input.subject,
      },
      '[mailer:dev] email (not sent)',
    );

    logger.debug(
      {
        html: input.html,
      },
      '[mailer:dev] body',
    );

    return;
  }

  const { data, error } = await getResend().emails.send({
    from: env.mail.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    ...(input.text ? { text: input.text } : {}),
  });

  if (error) {
    logger.error(
      {
        to: input.to,
        error,
      },
      '[mailer] failed to send email',
    );

    throw new Error(`Failed to send email: ${error.message}`);
  }

  logger.info(
    {
      to: input.to,
      emailId: data?.id,
    },
    '[mailer] email sent',
  );
}