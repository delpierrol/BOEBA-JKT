import nodemailer from 'nodemailer';

interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  from_name?: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

export async function sendEmail({ to, subject, body, from_name }: EmailPayload) {
  const mailer = getTransporter();
  if (!mailer) {
    console.warn('[Email] SMTP not configured. Skipping email to:', to);
    return { skipped: true, reason: 'SMTP not configured' };
  }

  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
  const from = from_name ? `"${from_name}" <${fromEmail}>` : fromEmail;
  const isHtml = /<[a-z][\s\S]*>/i.test(body);

  const info = await mailer.sendMail({
    from,
    to,
    subject,
    ...(isHtml ? { html: body } : { text: body }),
  });

  return { messageId: info.messageId };
}
