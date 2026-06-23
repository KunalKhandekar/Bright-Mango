import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../common/utils/logger.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
  return transporter;
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Low-level send. In development without SMTP configured, logs the email instead of
 * sending so the OTP flow is testable end-to-end without a mail server.
 */
export async function sendMail(input: SendMailInput): Promise<void> {
  if (!env.smtp.host) {
    logger.info({ to: input.to, subject: input.subject }, '[mailer:dev] email (not sent)');
    logger.debug({ html: input.html }, '[mailer:dev] body');
    return;
  }
  await getTransporter().sendMail({
    from: env.smtp.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
