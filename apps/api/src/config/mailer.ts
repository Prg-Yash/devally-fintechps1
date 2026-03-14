import nodemailer from 'nodemailer';

type MailPayload = {
  to: string;
  subject: string;
  title: string;
  message: string;
};

const sender = process.env.NOTIFICATION_EMAIL_FROM || process.env.GMAIL_ADDRESS;
const gmailUser = process.env.GMAIL_ADDRESS;
const gmailPass = process.env.GMAIL_APP_PASSWORD;

let transporter: nodemailer.Transporter | null = null;

if (gmailUser && gmailPass) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });
}

export const canSendNotificationEmail = Boolean(transporter && sender);

export const sendNotificationEmail = async ({ to, subject, title, message }: MailPayload) => {
  if (!transporter || !sender) {
    return { sent: false, reason: 'Email transport is not configured (set GMAIL_ADDRESS and GMAIL_APP_PASSWORD).' };
  }

  await transporter.sendMail({
    from: sender,
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="margin-bottom: 8px;">${title}</h2>
        <p style="color: #444; line-height: 1.5;">${message}</p>
        <p style="font-size: 12px; color: #777; margin-top: 24px;">
          This is an automated notification from Devally Fintech.
        </p>
      </div>
    `,
  });

  return { sent: true };
};
