import type { ComponentType } from "react";

export const authEmailKinds = [
  "confirmation",
  "recovery",
  "email_change",
  "magic_link",
  "invite",
  "reauthentication",
] as const;
export type AuthEmailKind = (typeof authEmailKinds)[number];
export interface EmailBrand {
  name: string;
  wordmark?: string;
  tagline?: string;
  supportEmail?: string;
  accentColor?: string;
  logo?: { src: string; width: number; height: number; alt?: string };
}
export interface EmailAddress {
  name?: string;
  email: string;
}
export interface AuthEmailCopy {
  subject: string;
  heading: string;
  preview: string;
  body: string;
  action: string;
  reassurance: string;
  unsolicited: string;
  linkHint?: string;
}
export interface AuthEmailTemplateProps {
  kind: AuthEmailKind;
  brand: EmailBrand;
  message: AuthEmailCopy;
  siteUrl: string;
  actionUrl: string;
  code: string;
}
export interface EmailConfig {
  brand: EmailBrand;
  from: EmailAddress;
  replyTo?: string;
  auth?: {
    actionUrls?: Partial<
      Record<Exclude<AuthEmailKind, "reauthentication">, string>
    >;
    copy?: Partial<Record<AuthEmailKind, Partial<AuthEmailCopy>>>;
    templates?: Partial<
      Record<AuthEmailKind, ComponentType<AuthEmailTemplateProps>>
    >;
  };
  tooling?: {
    templatesDirectory?: string;
    supabaseConfigPath?: string;
    previewDirectory?: string;
    reactEmailDirectory?: string;
  };
}
export type RenderedAuthEmails = Record<
  AuthEmailKind,
  { subject: string; html: string }
>;
