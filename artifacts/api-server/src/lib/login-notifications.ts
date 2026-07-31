import type { Request } from "express";
import { logger } from "./logger";
import { newSignInEmail, sendUserEmail } from "./email";
import { type SessionMetadata } from "./auth";
import { getClientIp } from "./forgot-password-throttle";
import { SUPPORT_EMAIL } from "./support-email";

const MAX_USER_AGENT_LENGTH = 500;

export function captureSessionMetadata(req: Request): SessionMetadata {
  const ip = getClientIp(req);
  const rawUa = req.headers["user-agent"];
  const userAgent =
    typeof rawUa === "string" && rawUa.trim().length > 0
      ? rawUa.slice(0, MAX_USER_AGENT_LENGTH)
      : null;
  return {
    ipAddress: ip && ip !== "unknown" ? ip : null,
    userAgent,
  };
}

export function getTrustedAppOrigin(req?: Request): string | null {
  const configured = process.env.APP_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (req) {
    const fwdHost = req.headers["x-forwarded-host"];
    const fwdProto = req.headers["x-forwarded-proto"];
    const host = (Array.isArray(fwdHost) ? fwdHost[0] : fwdHost)?.split(",")[0].trim();
    const proto = (Array.isArray(fwdProto) ? fwdProto[0] : fwdProto)?.split(",")[0].trim() || "https";
    if (host) return `${proto}://${host}`;
  }
  const replitApp = process.env.REPLIT_APP_DOMAIN?.trim();
  if (replitApp) return `https://${replitApp.replace(/\/$/, "")}`;
  const replitDev = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (replitDev) return `https://${replitDev.replace(/\/$/, "")}`;
  return null;
}

export function buildAppUrl(path: string, req?: Request): string | null {
  const origin = getTrustedAppOrigin(req);
  if (!origin) return null;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export function deviceLabelFromUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\//i.test(ua)
      ? "Opera"
      : /Firefox\//i.test(ua)
        ? "Firefox"
        : /Chrome\//i.test(ua)
          ? "Chrome"
          : /Safari\//i.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /Android/i.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/i.test(ua)
        ? "iOS"
        : /Mac OS X|Macintosh/i.test(ua)
          ? "macOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Unknown OS";
  return `${browser} on ${os}`;
}

export async function notifyNewSignIn(
  user: { name: string; email: string },
  metadata: SessionMetadata,
  req?: Request,
): Promise<void> {
  try {
    const { subject, html } = newSignInEmail({
      name: user.name,
      email: user.email,
      signedInAt: new Date(),
      deviceLabel: deviceLabelFromUserAgent(metadata.userAgent),
      ipAddress: metadata.ipAddress ?? null,
      activityUrl: buildAppUrl("/dashboard", req),
      changePasswordUrl: buildAppUrl("/change-password", req),
      supportEmail: SUPPORT_EMAIL,
    });
    const sent = await sendUserEmail(user.email, subject, html);
    logger.info(
      { email: user.email, sent },
      sent
        ? "New sign-in notification email sent"
        : "New sign-in notification email could not be sent",
    );
  } catch (err) {
    logger.error(
      { err, email: user.email },
      "Failed to send new sign-in notification email",
    );
  }
}
