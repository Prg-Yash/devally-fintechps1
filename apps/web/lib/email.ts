import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_ADDRESS,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendVerificationEmail({
  to,
  verificationUrl,
}: {
  to: string;
  verificationUrl: string;
}) {
  const mailOptions = {
    from: process.env.GMAIL_ADDRESS,
    to,
    subject: "Verify Your Email Address",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Verify Your Email Address</h2>
            <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
            <a href="${verificationUrl}" class="button">Verify Email</a>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all;">${verificationUrl}</p>
            <div class="footer">
              <p>If you didn't create an account, you can safely ignore this email.</p>
              <p>This link will expire in 24 hours.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${to}`);
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw error;
  }
}

export async function sendWelcomeEmail({
  to,
  name,
}: {
  to: string;
  name: string;
}) {
  const mailOptions = {
    from: process.env.GMAIL_ADDRESS,
    to,
    subject: "Welcome to Devally Fintech!",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #28a745; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Welcome to Devally Fintech, ${name}! 🎉</h2>
            <p>Thank you for joining us! We're excited to have you on board.</p>
            <p>Your account has been successfully created and verified. You can now access all the features and start your journey with us.</p>
            <a href="${process.env.BETTER_AUTH_URL || "http://localhost:3000"}" class="button">Get Started</a>
            <div class="footer">
              <p>If you have any questions or need assistance, feel free to reach out to our support team.</p>
              <p>Best regards,<br>The Devally Fintech Team</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${to}`);
  } catch (error) {
    console.error("Error sending welcome email:", error);
    throw error;
  }
}

export async function sendResetPasswordEmail({
  to,
  resetPasswordUrl,
}: {
  to: string;
  resetPasswordUrl: string;
}) {
  const mailOptions = {
    from: process.env.GMAIL_ADDRESS,
    to,
    subject: "Reset Your Password",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #dc3545; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Reset Your Password</h2>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <a href="${resetPasswordUrl}" class="button">Reset Password</a>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all;">${resetPasswordUrl}</p>
            <div class="footer">
              <p>If you didn't request a password reset, you can safely ignore this email.</p>
              <p>This link will expire in 1 hour.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Reset password email sent to ${to}`);
  } catch (error) {
    console.error("Error sending reset password email:", error);
    throw error;
  }
}

export async function sendDeleteAccountVerificationEmail({
  user,
  url,
}: {
  user: { name?: string | null; email: string };
  url: string;
}) {
  const mailOptions = {
    from: process.env.GMAIL_ADDRESS,
    to: user.email,
    subject: "Confirm Account Deletion",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .warning-box { background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 15px; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 24px; background-color: #dc3545; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Confirm Account Deletion</h2>
            <p>Hello ${user.name || "there"},</p>
            <p>We received a request to delete your account. This action is permanent and cannot be undone.</p>
            <div class="warning-box">
              <strong>⚠️ Warning:</strong> Once you confirm, all your data will be permanently deleted, including:
              <ul>
                <li>Your profile information</li>
                <li>Your account settings</li>
                <li>All associated data</li>
              </ul>
            </div>
            <p>If you're sure you want to proceed, click the button below to confirm the deletion:</p>
            <a href="${url}" class="button">Confirm Account Deletion</a>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all;">${url}</p>
            <div class="footer">
              <p>If you didn't request account deletion, please ignore this email and your account will remain active.</p>
              <p>This link will expire in 1 hour for your security.</p>
              <p>Best regards,<br>The Devally Fintech Team</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Delete account verification email sent to ${user.email}`);
  } catch (error) {
    console.error("Error sending delete account verification email:", error);
    throw error;
  }
}

export async function sendNotificationEmail({
  to,
  subject,
  title,
  message,
  actionUrl,
  actionLabel,
}: {
  to: string;
  subject: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
}) {
  const mailOptions = {
    from: process.env.GMAIL_ADDRESS,
    to,
    subject,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .card { border: 1px solid #eee; border-radius: 8px; padding: 16px; margin-top: 12px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #1a2406; color: #d9f24f !important; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 700; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>${title}</h2>
            <div class="card">
              <p>${message}</p>
            </div>
            ${actionUrl
              ? `<a href="${actionUrl}" class="button">${actionLabel || "Open Agreement"}</a>
                 <p>Or copy and paste this link in your browser:</p>
                 <p style="word-break: break-all;">${actionUrl}</p>`
              : ""}
            <div class="footer">
              <p>This is an automated notification from Devally Fintech.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[Email] Notification email sent to ${to} with subject "${subject}"`);
  } catch (error) {
    console.error("Error sending notification email:", error);
    throw error;
  }
}

export async function sendAgreementDraftEmail({
  to,
  freelancerName,
  clientName,
  agreementTitle,
  agreementLink,
}: {
  to: string;
  freelancerName?: string;
  clientName: string;
  agreementTitle: string;
  agreementLink: string;
}) {
  const mailOptions = {
    from: process.env.GMAIL_ADDRESS,
    to,
    subject: "Devally: New Draft Agreement Waiting for Your Review",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #1a2406; color: #d9f24f !important; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 700; }
            .card { border: 1px solid #eee; border-radius: 8px; padding: 16px; margin-top: 12px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>New Draft Agreement Shared</h2>
            <p>Hello ${freelancerName || "there"},</p>
            <p><strong>${clientName}</strong> has shared a new agreement draft with you for review and confirmation.</p>
            <div class="card">
              <p><strong>Agreement:</strong> ${agreementTitle}</p>
              <p>Please review the draft, request changes if needed, and approve when ready.</p>
            </div>
            <a href="${agreementLink}" class="button">Review Draft Agreement</a>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all;">${agreementLink}</p>
            <div class="footer">
              <p>This is an automated workflow email from Devally Fintech.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[Email] Draft agreement email sent to ${to} for \"${agreementTitle}\"`);
  } catch (error) {
    console.error("Error sending draft agreement email:", error);
    throw error;
  }
}
