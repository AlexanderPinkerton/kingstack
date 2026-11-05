import { createHash } from "node:crypto";
import { assertEmailAddress, defineEmailConfig } from "./index";
import {
  authEmailKinds,
  type EmailConfig,
  type HostedEmailEnvironment,
  type RenderedAuthEmails,
} from "./types";

export type AuthSettings = Record<string, unknown>;
export type AuthPatch = Record<string, string | number | boolean>;

export function authEmailSettings(
  current: AuthSettings,
  config: EmailConfig,
  environment: HostedEmailEnvironment,
  templates: RenderedAuthEmails,
): AuthPatch {
  defineEmailConfig(config);
  const site = new URL(environment.siteUrl);
  if (
    site.protocol !== "https:" ||
    site.username ||
    site.password ||
    site.search ||
    site.hash ||
    site.pathname !== "/"
  ) {
    throw new Error("Hosted Auth requires a canonical HTTPS site origin.");
  }
  assertEmailAddress(config.from.email);
  if (!environment.resendApiKey.startsWith("re_"))
    throw new Error("Configure the Resend sending key.");
  if (current.hook_send_email_enabled === true)
    throw new Error(
      "A Send Email hook is enabled. Review it before configuring SMTP.",
    );
  const existing = new Set<string>();
  if (typeof current.uri_allow_list === "string") {
    for (const entry of current.uri_allow_list.split(",")) {
      if (entry.trim()) existing.add(entry.trim());
    }
  }
  for (const path of config.auth?.callbackPaths || [
    "/auth/callback",
    "/auth/confirm",
  ]) {
    if (!/^\/(?!\/)[a-zA-Z0-9/_-]+$/.test(path))
      throw new Error(
        "Auth callback paths must be literal paths on the configured site.",
      );
    existing.add(`${site.origin}${path}`);
    existing.add(`${site.origin}${path}?**`);
  }
  const previousRate = Number(current.rate_limit_email_sent);
  let hourlyRate = 30;
  if (Number.isFinite(previousRate) && previousRate > hourlyRate)
    hourlyRate = previousRate;
  // Email delivery and branding must never implicitly change account policy.
  const patch: AuthPatch = {
    site_url: site.origin,
    uri_allow_list: [...existing].join(","),
    smtp_host: "smtp.resend.com",
    smtp_port: "465",
    smtp_user: "resend",
    smtp_pass: environment.resendApiKey,
    smtp_admin_email: config.from.email,
    smtp_sender_name: config.from.name || config.brand.name,
    rate_limit_email_sent: hourlyRate,
  };
  for (const kind of authEmailKinds) {
    patch[`mailer_subjects_${kind}`] = templates[kind].subject;
    patch[`mailer_templates_${kind}_content`] = templates[kind].html;
  }
  return patch;
}
export function authVerificationPolicy(): AuthPatch {
  return {
    mailer_autoconfirm: false,
    mailer_allow_unverified_email_sign_ins: false,
  };
}
export function authEmailPlan(
  settings: AuthPatch,
): Record<string, string | number | boolean> {
  const plan = { ...settings };
  for (const [key, value] of Object.entries(settings)) {
    if (key === "smtp_pass") plan[key] = "[configured Resend key; redacted]";
    else if (key.startsWith("mailer_templates_")) {
      plan[key] =
        `HTML template (${Buffer.byteLength(String(value))} bytes; sha256 ${createHash("sha256").update(String(value)).digest("hex").slice(0, 12)})`;
    }
  }
  return plan;
}
