import { Resend } from 'resend';
import { ENV } from '../config/env.js';

type EmailPayload = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    type?: string;
  }>;
};

const resend = ENV.RESEND_API_KEY ? new Resend(ENV.RESEND_API_KEY) : null;

// Basic HTML-to-text fallback for providers that require text.
const stripHtml = (value: string) =>
  value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export async function sendEmail(payload: EmailPayload) {
  if (!resend || !ENV.RESEND_FROM_EMAIL) {
    const recipients = Array.isArray(payload.to) ? payload.to.join(',') : payload.to;
    const body = payload.text ?? payload.html ?? '';
    console.log(`[email:stub] to=${recipients} subject="${payload.subject}" body="${body.slice(0, 120)}${body.length > 120 ? '...' : ''}"`);
    return { to: payload.to, subject: payload.subject };
  }

  const text = payload.text ?? (payload.html ? stripHtml(payload.html) : '');

  return resend.emails.send({
    from: ENV.RESEND_FROM_EMAIL,
    to: payload.to,
    subject: payload.subject,
    text,
    html: payload.html,
    attachments: payload.attachments
  });
}

export async function sendEmailStub(to: string, subject: string, body: string) {
  console.warn('sendEmailStub is deprecated. Use sendEmail instead.');
  return sendEmail({ to, subject, text: body });
}
