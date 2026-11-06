import type { EmailConfig, EmailAddress } from "./types";
export type {
  EmailConfig,
  EmailBrand,
  EmailAddress,
  AuthEmailKind,
  AuthEmailCopy,
  AuthEmailTemplateProps,
  HostedEmailEnvironment,
  HostedAuthEnvironment,
  RenderedAuthEmails,
} from "./types";
export { authEmailKinds } from "./types";

export function assertEmailAddress(value: string): void {
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) {
    throw new Error("A valid email address is required.");
  }
}
export function formatEmailAddress(address: EmailAddress): string {
  assertEmailAddress(address.email);
  if (!address.name) return address.email;
  if (/[\r\n<>]/.test(address.name)) throw new Error("Invalid sender name.");
  const name = address.name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${name}" <${address.email}>`;
}
export function defineEmailConfig<const T extends EmailConfig>(config: T): T {
  if (!config.brand?.name?.trim())
    throw new Error("Configure an email brand name.");
  formatEmailAddress(config.from);
  if (config.replyTo) assertEmailAddress(config.replyTo);
  if (config.brand.supportEmail) assertEmailAddress(config.brand.supportEmail);
  if (config.brand.logo) {
    const { src, width, height } = config.brand.logo;
    let url: URL;
    try {
      url = new URL(src);
    } catch {
      throw new Error("Email logo requires an absolute HTTPS URL.");
    }
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error("Email logo requires an absolute HTTPS URL.");
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0
    )
      throw new Error("Email logo requires positive integer dimensions.");
  }
  if (
    config.brand.accentColor &&
    !/^#[a-fA-F0-9]{6}$/.test(config.brand.accentColor)
  ) {
    throw new Error("Email accentColor must be a six-digit hex color.");
  }
  return config;
}
