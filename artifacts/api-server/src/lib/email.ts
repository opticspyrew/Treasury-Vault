import nodemailer from "nodemailer";
import { logger } from "./logger";
import { SUPPORT_EMAIL as ADMIN_EMAIL } from "./support-email";

// Escape user-supplied fields before interpolating into the HTML email body.
function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createTransporter() {
  const user = process.env.SMTP_USER;
  const rawPass = process.env.SMTP_PASS;

  if (!user || !rawPass) {
    return null;
  }

  // Gmail App Passwords are displayed with spaces but must be used without them
  const pass = rawPass.replace(/\s+/g, "");

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: true },
  });
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export async function sendAdminEmail(
  subject: string,
  html: string,
  attachments?: EmailAttachment[],
): Promise<boolean> {
  const transporter = createTransporter();

  if (!transporter) {
    logger.warn("Email not configured — SMTP_USER and SMTP_PASS env vars required. Email skipped.");
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"Firm Admin System" <${process.env.SMTP_USER}>`,
      to: ADMIN_EMAIL,
      subject,
      html,
      attachments,
    });
    logger.info({ to: ADMIN_EMAIL, subject, attachments: attachments?.length ?? 0 }, "Admin email sent");
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to send admin email");
    return false;
  }
}

export function newKycSubmissionEmail(params: {
  user: { id: number; name: string; email: string };
  submission: {
    id: number;
    fullName: string;
    dateOfBirth: string;
    address: string;
    city: string;
    country: string;
    idType: string;
    idNumber: string;
    createdAt: Date;
  };
}): { subject: string; html: string } {
  const { user, submission } = params;
  const subject = `[Action Required] KYC Verification — ${submission.fullName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 8px;">
      <div style="background: #4338ca; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">New KYC Verification Submission</h1>
        <p style="color: #c7d2fe; margin: 4px 0 0; font-size: 13px;">Approval required before user can Send or Withdraw</p>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 150px;">Account</td><td style="padding: 8px 0; color: #111827;">${escapeHtml(user.name)} &lt;${escapeHtml(user.email)}&gt;</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Submission ID</td><td style="padding: 8px 0; color: #111827; font-family: monospace;">#${submission.id}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Legal Name</td><td style="padding: 8px 0; font-weight: 600; color: #111827;">${escapeHtml(submission.fullName)}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date of Birth</td><td style="padding: 8px 0; color: #111827;">${escapeHtml(submission.dateOfBirth)}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Address</td><td style="padding: 8px 0; color: #111827;">${escapeHtml(submission.address)}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">City</td><td style="padding: 8px 0; color: #111827;">${escapeHtml(submission.city)}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Country</td><td style="padding: 8px 0; color: #111827;">${escapeHtml(submission.country)}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">ID Type</td><td style="padding: 8px 0; color: #111827;">${escapeHtml(submission.idType)}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">ID Number</td><td style="padding: 8px 0; color: #111827; font-family: monospace;">${escapeHtml(submission.idNumber)}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Submitted</td><td style="padding: 8px 0; color: #111827;">${escapeHtml(submission.createdAt.toUTCString())}</td></tr>
        </table>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 14px; color: #374151; margin: 0 0 12px;">The user's government-issued ID photo is attached to this email. Review it and approve or reject the submission in the admin dashboard's KYC page.</p>
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">This is an automated notification from your Firm Admin System.</p>
      </div>
    </div>
  `;
  return { subject, html };
}

export async function sendUserEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const transporter = createTransporter();

  if (!transporter) {
    logger.warn(
      { to, subject },
      "Email not configured — SMTP_USER and SMTP_PASS env vars required. Email skipped.",
    );
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"Treasury Vault" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    logger.info({ to, subject }, "User email sent");
    return true;
  } catch (err) {
    logger.error({ err, to }, "Failed to send user email");
    return false;
  }
}

export function accountLockedAdminEmail(params: {
  user: { id: number; name: string; email: string };
  failureCount: number;
  maxFailures: number;
  lockedAt: Date;
  usersPageUrl: string | null;
}): { subject: string; html: string } {
  const { user, failureCount, maxFailures, lockedAt, usersPageUrl } = params;
  const subject = `[Account Locked] ${user.name} (${user.email}) hit the sign-in lockout threshold`;
  const safeName = escapeHtml(user.name);
  const safeEmail = escapeHtml(user.email);
  const safeTime = escapeHtml(lockedAt.toUTCString());
  const ctaButton = usersPageUrl
    ? `<p style="text-align: center; margin: 24px 0;">
         <a href="${escapeHtml(usersPageUrl)}" style="display: inline-block; background: #b91c1c; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
           Open Users page
         </a>
       </p>`
    : "";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 8px;">
      <div style="background: #b91c1c; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Customer account locked</h1>
        <p style="color: #fecaca; margin: 4px 0 0; font-size: 13px;">A user just hit the sign-in failure threshold and is temporarily locked out</p>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 160px;">User</td><td style="padding: 8px 0; color: #111827;">${safeName} &lt;${safeEmail}&gt;</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">User ID</td><td style="padding: 8px 0; color: #111827; font-family: monospace;">#${user.id}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Failed attempts</td><td style="padding: 8px 0; color: #111827;">${failureCount} of ${maxFailures}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Locked at</td><td style="padding: 8px 0; color: #111827;">${safeTime}</td></tr>
        </table>
        <p style="font-size: 14px; color: #374151; margin: 16px 0 0;">
          The customer can't sign in until the lockout window expires. Consider reaching out
          to confirm it's really them, or unlock the account from the Users page if appropriate.
        </p>
        ${ctaButton}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">This is an automated notification from your Firm Admin System. You'll only get one email per lockout window per account.</p>
      </div>
    </div>
  `;
  return { subject, html };
}

export function accountLockedUserEmail(params: {
  name: string;
  email: string;
  lockedAt: Date;
  unlocksInMinutes: number;
  resetPasswordUrl: string | null;
  supportEmail: string;
}): { subject: string; html: string } {
  const {
    name,
    email,
    lockedAt,
    unlocksInMinutes,
    resetPasswordUrl,
    supportEmail,
  } = params;
  const subject = "Your Treasury Vault account is temporarily locked";
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeTime = escapeHtml(lockedAt.toUTCString());
  const safeSupport = escapeHtml(supportEmail);
  const safeMinutes = escapeHtml(String(unlocksInMinutes));
  const resetLink = resetPasswordUrl
    ? `<a href="${escapeHtml(resetPasswordUrl)}" style="color: #1e3a5f; font-weight: 600;">reset your password</a>`
    : `<strong>reset your password</strong>`;
  const ctaButton = resetPasswordUrl
    ? `<p style="text-align: center; margin: 24px 0;">
         <a href="${escapeHtml(resetPasswordUrl)}" style="display: inline-block; background: #b91c1c; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
           Reset your password
         </a>
       </p>`
    : "";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 8px;">
      <div style="background: #b91c1c; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Your account is temporarily locked</h1>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
        <p style="font-size: 14px; color: #111827; margin: 0 0 16px;">Hi ${safeName || "there"},</p>
        <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">
          We temporarily locked your Treasury Vault account (<strong>${safeEmail}</strong>) after too many
          failed sign-in attempts. This is an automatic safety measure to protect your account.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 160px;">Locked at</td>
            <td style="padding: 8px 0; color: #111827; font-size: 13px;">${safeTime}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Auto-unlocks in</td>
            <td style="padding: 8px 0; color: #111827; font-size: 13px;">about ${safeMinutes} minute${unlocksInMinutes === 1 ? "" : "s"}</td>
          </tr>
        </table>
        <p style="font-size: 14px; color: #374151; margin: 16px 0;">
          If this was you and you forgot your password, you can wait for the lock to expire and try again,
          or ${resetLink} now to regain access right away.
        </p>
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
          <p style="font-size: 13px; color: #92400e; margin: 0; font-weight: 600;">If this wasn't you</p>
          <p style="font-size: 13px; color: #78350f; margin: 6px 0 0;">
            Someone else may be trying to access your account. We recommend you reset your password
            immediately and contact our support team at
            <a href="mailto:${safeSupport}" style="color: #1e3a5f; font-weight: 600;">${safeSupport}</a>.
          </p>
        </div>
        ${ctaButton}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; margin: 0;">
          This is an automated security notification from Treasury Vault. You'll only get one email per
          lockout window.
        </p>
      </div>
    </div>
  `;
  return { subject, html };
}

export function passwordResetEmail(params: {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}): { subject: string; html: string } {
  const { name, resetUrl, expiresInMinutes } = params;
  const subject = "Reset your Treasury Vault password";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 8px;">
      <div style="background: #1e3a5f; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Reset your password</h1>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
        <p style="font-size: 14px; color: #111827; margin: 0 0 16px;">Hi ${name || "there"},</p>
        <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">
          We received a request to reset the password for your Treasury Vault account. Click the
          button below to set a new password. This link will expire in ${expiresInMinutes} minutes
          and can only be used once.
        </p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #1e3a5f; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Reset password
          </a>
        </p>
        <p style="font-size: 12px; color: #6b7280; margin: 0 0 8px;">
          If the button doesn't work, copy and paste this URL into your browser:
        </p>
        <p style="font-size: 12px; color: #1e3a5f; word-break: break-all; margin: 0 0 16px;">
          ${resetUrl}
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; margin: 0;">
          If you didn't request a password reset, you can safely ignore this email — your password
          will stay the same.
        </p>
      </div>
    </div>
  `;
  return { subject, html };
}

export function passwordChangedEmail(params: {
  name: string;
  email: string;
  changedAt: Date;
  method: "reset" | "change";
  supportEmail: string;
}): { subject: string; html: string } {
  const { name, email, changedAt, method, supportEmail } = params;
  const subject = "Your Treasury Vault password was changed";
  const methodLabel =
    method === "reset"
      ? "using the email-based password reset flow"
      : "from your account settings";
  const timestamp = changedAt.toUTCString();
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 8px;">
      <div style="background: #1e3a5f; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Password changed</h1>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
        <p style="font-size: 14px; color: #111827; margin: 0 0 16px;">Hi ${name || "there"},</p>
        <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">
          The password for your Treasury Vault account (<strong>${email}</strong>) was just changed ${methodLabel}.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 130px;">When</td>
            <td style="padding: 8px 0; color: #111827; font-size: 13px;">${timestamp}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Account</td>
            <td style="padding: 8px 0; color: #111827; font-size: 13px;">${email}</td>
          </tr>
        </table>
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
          <p style="font-size: 13px; color: #92400e; margin: 0; font-weight: 600;">Didn't make this change?</p>
          <p style="font-size: 13px; color: #78350f; margin: 6px 0 0;">
            If you didn't change your password, your account may be compromised. Contact our support team immediately at
            <a href="mailto:${supportEmail}" style="color: #1e3a5f; font-weight: 600;">${supportEmail}</a>
            so we can help you secure your account.
          </p>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; margin: 0;">
          This is an automated security notification from Treasury Vault. You're receiving it because the password
          on your account was changed.
        </p>
      </div>
    </div>
  `;
  return { subject, html };
}

export function newSignInEmail(params: {
  name: string;
  email: string;
  signedInAt: Date;
  deviceLabel: string;
  ipAddress: string | null;
  region?: string | null;
  activityUrl: string | null;
  changePasswordUrl: string | null;
  supportEmail: string;
}): { subject: string; html: string } {
  const {
    name,
    email,
    signedInAt,
    deviceLabel,
    ipAddress,
    region,
    activityUrl,
    changePasswordUrl,
    supportEmail,
  } = params;
  const subject = "New sign-in to your Treasury Vault account";
  const timestamp = signedInAt.toUTCString();
  // We always show an "IP / Region" row so the user can recognize the sign-in.
  // Either field falls back to "Unavailable" when we don't have it (e.g. no
  // geo-IP service configured for region, or X-Forwarded-For absent).
  const ipText = ipAddress || "Unavailable";
  const regionText = region || "Unavailable";
  const ipLine = `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">IP / Region</td><td style="padding: 8px 0; color: #111827; font-size: 13px;">${ipText} &middot; ${regionText}</td></tr>`;
  const activityLink = activityUrl
    ? `<a href="${activityUrl}" style="color: #1e3a5f; font-weight: 600;">recent activity</a>`
    : `<strong>recent activity</strong>`;
  const changeLink = changePasswordUrl
    ? `<a href="${changePasswordUrl}" style="color: #1e3a5f; font-weight: 600;">change your password</a>`
    : `<strong>change your password</strong>`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 8px;">
      <div style="background: #1e3a5f; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">New sign-in detected</h1>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
        <p style="font-size: 14px; color: #111827; margin: 0 0 16px;">Hi ${name || "there"},</p>
        <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">
          We detected a sign-in to your Treasury Vault account (<strong>${email}</strong>) from a device or
          location we haven't seen before.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 130px;">When</td>
            <td style="padding: 8px 0; color: #111827; font-size: 13px;">${timestamp}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Device</td>
            <td style="padding: 8px 0; color: #111827; font-size: 13px;">${deviceLabel}</td>
          </tr>
          ${ipLine}
        </table>
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
          <p style="font-size: 13px; color: #92400e; margin: 0; font-weight: 600;">If this wasn't you</p>
          <p style="font-size: 13px; color: #78350f; margin: 6px 0 0;">
            Review your ${activityLink} in the dashboard, ${changeLink} immediately, and contact our support team at
            <a href="mailto:${supportEmail}" style="color: #1e3a5f; font-weight: 600;">${supportEmail}</a>.
          </p>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; margin: 0;">
          This is an automated security notification from Treasury Vault. You're receiving it because a new
          device just signed in to your account.
        </p>
      </div>
    </div>
  `;
  return { subject, html };
}

export function kycApprovedEmail(params: {
  name: string;
  email: string;
  decidedAt: Date;
  dashboardUrl: string | null;
  supportEmail: string;
}): { subject: string; html: string } {
  const { name, email, decidedAt, dashboardUrl, supportEmail } = params;
  const subject = "Your Treasury Vault identity verification was approved";
  const timestamp = decidedAt.toUTCString();
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeTime = escapeHtml(timestamp);
  const safeSupport = escapeHtml(supportEmail);
  const ctaButton = dashboardUrl
    ? `<p style="text-align: center; margin: 24px 0;">
         <a href="${escapeHtml(dashboardUrl)}" style="display: inline-block; background: #15803d; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
           Open your dashboard
         </a>
       </p>`
    : "";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 8px;">
      <div style="background: #15803d; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Identity verification approved</h1>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
        <p style="font-size: 14px; color: #111827; margin: 0 0 16px;">Hi ${safeName || "there"},</p>
        <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">
          Good news — we've reviewed and <strong>approved</strong> the identity verification for
          your Treasury Vault account (<strong>${safeEmail}</strong>). You can now use
          <strong>Send</strong> and <strong>Withdraw</strong> from your dashboard.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 130px;">Decision</td>
            <td style="padding: 8px 0; color: #111827; font-size: 13px;">Approved</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">When</td>
            <td style="padding: 8px 0; color: #111827; font-size: 13px;">${safeTime}</td>
          </tr>
        </table>
        ${ctaButton}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; margin: 0;">
          Questions? Contact us at
          <a href="mailto:${safeSupport}" style="color: #15803d; font-weight: 600;">${safeSupport}</a>.
          This is an automated notification from Treasury Vault.
        </p>
      </div>
    </div>
  `;
  return { subject, html };
}

export function kycRejectedEmail(params: {
  name: string;
  email: string;
  decidedAt: Date;
  reviewerNotes: string;
  resubmitUrl: string | null;
  supportEmail: string;
}): { subject: string; html: string } {
  const { name, email, decidedAt, reviewerNotes, resubmitUrl, supportEmail } = params;
  const subject = "Action needed: your Treasury Vault identity verification was not approved";
  const timestamp = decidedAt.toUTCString();
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeTime = escapeHtml(timestamp);
  const safeNotes = escapeHtml(reviewerNotes);
  const safeSupport = escapeHtml(supportEmail);
  const ctaButton = resubmitUrl
    ? `<p style="text-align: center; margin: 24px 0;">
         <a href="${escapeHtml(resubmitUrl)}" style="display: inline-block; background: #b91c1c; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
           Resubmit verification
         </a>
       </p>`
    : "";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 8px;">
      <div style="background: #b91c1c; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Identity verification not approved</h1>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
        <p style="font-size: 14px; color: #111827; margin: 0 0 16px;">Hi ${safeName || "there"},</p>
        <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">
          We've reviewed the identity verification for your Treasury Vault account
          (<strong>${safeEmail}</strong>) and weren't able to approve it. Send and
          Withdraw remain disabled until a new submission is approved.
        </p>
        <div style="background: #fef2f2; border-left: 4px solid #b91c1c; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
          <p style="font-size: 13px; color: #7f1d1d; margin: 0 0 6px; font-weight: 600;">Reviewer's note</p>
          <p style="font-size: 13px; color: #7f1d1d; margin: 0; white-space: pre-wrap;">${safeNotes}</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 130px;">Decision</td>
            <td style="padding: 8px 0; color: #111827; font-size: 13px;">Not approved</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">When</td>
            <td style="padding: 8px 0; color: #111827; font-size: 13px;">${safeTime}</td>
          </tr>
        </table>
        ${ctaButton}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; margin: 0;">
          Need help? Contact us at
          <a href="mailto:${safeSupport}" style="color: #b91c1c; font-weight: 600;">${safeSupport}</a>.
          This is an automated notification from Treasury Vault.
        </p>
      </div>
    </div>
  `;
  return { subject, html };
}

export function paymentConfirmationDecisionEmail(params: {
  name: string;
  email: string;
  decision: "approved" | "rejected";
  decidedAt: Date;
  amount?: string | null;
  currency?: string | null;
  invoiceUrl: string | null;
  supportEmail: string;
}): { subject: string; html: string } {
  const { name, email, decision, decidedAt, amount, currency, invoiceUrl, supportEmail } = params;
  const approved = decision === "approved";
  const subject = approved
    ? "Your Treasury Vault payment confirmation was approved"
    : "Action needed: your Treasury Vault payment confirmation was not approved";
  const headerColor = approved ? "#15803d" : "#b91c1c";
  const buttonLabel = approved ? "Continue on your invoice" : "Retry payment confirmation";
  const decisionLabel = approved ? "Approved" : "Not approved";
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeTime = escapeHtml(decidedAt.toUTCString());
  const safeSupport = escapeHtml(supportEmail);
  const amountStr = amount
    ? `${currency ?? "USD"} ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    : null;
  const amountRow = amountStr
    ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Amount</td><td style="padding: 8px 0; color: #111827; font-size: 13px;">${escapeHtml(amountStr)}</td></tr>`
    : "";
  const intro = approved
    ? `Good news — we've reviewed and <strong>approved</strong> the payment confirmation for your Treasury Vault account (<strong>${safeEmail}</strong>). You can continue with your withdrawal from the invoice page.`
    : `We've reviewed the payment confirmation for your Treasury Vault account (<strong>${safeEmail}</strong>) and weren't able to approve it. You can retry the confirmation from the invoice page.`;
  const ctaButton = invoiceUrl
    ? `<p style="text-align: center; margin: 24px 0;">
         <a href="${escapeHtml(invoiceUrl)}" style="display: inline-block; background: ${headerColor}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
           ${buttonLabel}
         </a>
       </p>`
    : "";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 8px;">
      <div style="background: ${headerColor}; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Payment confirmation ${approved ? "approved" : "not approved"}</h1>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
        <p style="font-size: 14px; color: #111827; margin: 0 0 16px;">Hi ${safeName || "there"},</p>
        <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">${intro}</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 130px;">Decision</td>
            <td style="padding: 8px 0; color: #111827; font-size: 13px;">${decisionLabel}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">When</td>
            <td style="padding: 8px 0; color: #111827; font-size: 13px;">${safeTime}</td>
          </tr>
          ${amountRow}
        </table>
        ${ctaButton}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; margin: 0;">
          Questions? Contact us at
          <a href="mailto:${safeSupport}" style="color: ${headerColor}; font-weight: 600;">${safeSupport}</a>.
          This is an automated notification from Treasury Vault.
        </p>
      </div>
    </div>
  `;
  return { subject, html };
}

export function newClientEmail(client: {
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  createdAt: Date;
}): { subject: string; html: string } {
  const subject = `[Action Required] New Client Registration — ${client.name}`;
  const safeName = escapeHtml(client.name);
  const safeEmail = escapeHtml(client.email);
  const safePhone = escapeHtml(client.phone);
  const safeCompany = escapeHtml(client.company);
  const safeCreatedAt = escapeHtml(client.createdAt.toUTCString());
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 8px;">
      <div style="background: #1e3a5f; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">New Client Registration</h1>
        <p style="color: #93c5fd; margin: 4px 0 0; font-size: 13px;">Approval required</p>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 130px;">Name</td><td style="padding: 8px 0; font-weight: 600; color: #111827;">${safeName}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email</td><td style="padding: 8px 0; font-weight: 600; color: #111827;">${safeEmail}</td></tr>
          ${client.phone ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Phone</td><td style="padding: 8px 0; color: #111827;">${safePhone}</td></tr>` : ""}
          ${client.company ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Company</td><td style="padding: 8px 0; color: #111827;">${safeCompany}</td></tr>` : ""}
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Registered</td><td style="padding: 8px 0; color: #111827;">${safeCreatedAt}</td></tr>
        </table>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 14px; color: #374151; margin: 0 0 12px;">Review this new client registration in the admin dashboard and update their status to <strong>Approved</strong> or <strong>Denied</strong>.</p>
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">This is an automated notification from your Firm Admin System.</p>
      </div>
    </div>
  `;
  return { subject, html };
}

export function newServiceRequestEmail(params: {
  client: { name: string; email: string };
  request: { type: string; amount?: string | null; currency: string; notes?: string | null; createdAt: Date };
}): { subject: string; html: string } {
  const { client, request } = params;
  const typeLabel = request.type.charAt(0).toUpperCase() + request.type.slice(1);
  const subject = `[Action Required] ${typeLabel} Request — ${client.name}`;
  const amountStr = request.amount ? `${request.currency} ${Number(request.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—";
  const safeTypeLabel = escapeHtml(typeLabel);
  const safeClientName = escapeHtml(client.name);
  const safeClientEmail = escapeHtml(client.email);
  const safeAmount = escapeHtml(amountStr);
  const safeNotes = escapeHtml(request.notes);
  const safeCreatedAt = escapeHtml(request.createdAt.toUTCString());
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 8px;">
      <div style="background: #92400e; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">${safeTypeLabel} Request</h1>
        <p style="color: #fcd34d; margin: 4px 0 0; font-size: 13px;">Approval required</p>
      </div>
      <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 130px;">Client</td><td style="padding: 8px 0; font-weight: 600; color: #111827;">${safeClientName}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email</td><td style="padding: 8px 0; color: #111827;">${safeClientEmail}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Request Type</td><td style="padding: 8px 0; font-weight: 600; color: #111827;">${safeTypeLabel}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount</td><td style="padding: 8px 0; font-weight: 700; color: #111827; font-size: 16px;">${safeAmount}</td></tr>
          ${request.notes ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Notes</td><td style="padding: 8px 0; color: #111827;">${safeNotes}</td></tr>` : ""}
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Submitted</td><td style="padding: 8px 0; color: #111827;">${safeCreatedAt}</td></tr>
        </table>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 14px; color: #374151; margin: 0 0 12px;">Log in to the admin dashboard to <strong>Approve</strong> or <strong>Deny</strong> this request.</p>
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">This is an automated notification from your Firm Admin System.</p>
      </div>
    </div>
  `;
  return { subject, html };
}
