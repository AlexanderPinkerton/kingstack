import { createElement } from "react";
import { render } from "@react-email/render";
import { defineEmailConfig } from "./index";
import { AccountAction, defaultAuthCopy } from "./react";
import {
  authEmailKinds,
  type EmailConfig,
  type RenderedAuthEmails,
} from "./types";

export async function renderAuthEmails(
  config: EmailConfig,
  options: { preview?: boolean } = {},
): Promise<RenderedAuthEmails> {
  defineEmailConfig(config);
  const templates = {} as RenderedAuthEmails;
  const brand = {
    ...config.brand,
    supportEmail:
      config.brand.supportEmail || config.replyTo || config.from.email,
  };
  for (const kind of authEmailKinds) {
    const customActionUrl =
      kind === "reauthentication" ? undefined : config.auth?.actionUrls?.[kind];
    if (
      customActionUrl &&
      (!/^(\{\{ \.SiteURL \}\}\/(?!\/)|\{\{ \.RedirectTo \}\}[?&])/.test(
        customActionUrl,
      ) ||
        !customActionUrl.includes("{{ .TokenHash }}"))
    ) {
      throw new Error(
        `Auth template ${kind} action URL must use SiteURL with a path or RedirectTo with query parameters, and retain TokenHash.`,
      );
    }
    const message = {
      ...defaultAuthCopy[kind],
      ...(customActionUrl
        ? { linkHint: "This link expires and can only be used once." }
        : {}),
      ...config.auth?.copy?.[kind],
    };
    const component = config.auth?.templates?.[kind] || AccountAction;
    let siteUrl = "{{ .SiteURL }}";
    let actionUrl = customActionUrl || "{{ .ConfirmationURL }}";
    let code = "{{ .Token }}";
    if (options.preview) {
      siteUrl = "https://example.invalid";
      actionUrl = "https://example.invalid/auth-preview";
      code = "123456";
    }
    const html = await render(
      createElement(component, {
        kind,
        brand,
        message,
        siteUrl,
        actionUrl,
        code,
      }),
      { pretty: true },
    );
    if (!options.preview) {
      let required = "{{ .ConfirmationURL }}";
      if (customActionUrl) required = "{{ .TokenHash }}";
      if (kind === "reauthentication") required = "{{ .Token }}";
      if (!html.includes(required))
        throw new Error(`Auth template ${kind} must retain ${required}.`);
    }
    if (Buffer.byteLength(html) >= 100_000)
      throw new Error(`Auth template ${kind} exceeds 100 KB.`);
    templates[kind] = { subject: `${message.subject} | ${brand.name}`, html };
  }
  return templates;
}
