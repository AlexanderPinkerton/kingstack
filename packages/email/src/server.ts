import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { Resend } from "resend";
import {
  assertEmailAddress,
  defineEmailConfig,
  formatEmailAddress,
} from "./index";
import type { EmailConfig } from "./types";

export type Delivery =
  { type: "resend"; apiKey: string } | { type: "capture"; directory?: string };
export type SendEmail = {
  to: string | string[];
  from?: string;
  replyTo?: string;
  subject: string;
  text?: string;
  idempotencyKey?: string;
} & ({ html: string; react?: never } | { react: ReactElement; html?: never });
export type SendResult =
  | { status: "accepted"; id: string }
  | { status: "captured"; id: string; path: string };
export interface Mailer {
  send(message: SendEmail): Promise<SendResult>;
}

export function createMailer(options: {
  config: EmailConfig;
  environment: string;
  delivery: Delivery;
}): Mailer {
  const config = defineEmailConfig(options.config);
  const { delivery, environment } = options;
  if (!environment.trim())
    throw new Error("An explicit mailer environment is required.");
  if (
    delivery.type === "capture" &&
    ((environment !== "local" && environment !== "test") ||
      process.env.NODE_ENV === "production")
  ) {
    throw new Error(
      "Email capture is only available in local and test environments.",
    );
  }
  if (delivery.type === "resend" && !delivery.apiKey?.startsWith("re_")) {
    throw new Error("Email delivery requires a configured Resend key.");
  }
  const from = formatEmailAddress(config.from);
  let resend: Resend | undefined;
  if (delivery.type === "resend") resend = new Resend(delivery.apiKey);
  return {
    async send(message) {
      const recipients = Array.isArray(message.to) ? message.to : [message.to];
      if (!recipients.length) throw new Error("Email recipients are required.");
      for (const recipient of recipients) assertEmailAddress(recipient);
      if (!message.subject.trim() || /[\r\n]/.test(message.subject))
        throw new Error("A valid email subject is required.");
      if (message.from && /[\r\n]/.test(message.from))
        throw new Error("Invalid sender address.");
      const replyTo = message.replyTo || config.replyTo;
      if (replyTo) assertEmailAddress(replyTo);
      let html: string;
      let text = message.text;
      if (message.react !== undefined) {
        html = await render(message.react);
        if (text === undefined)
          text = await render(message.react, { plainText: true });
      } else if (typeof message.html === "string") {
        html = message.html;
      } else {
        throw new Error("Email HTML or a React template is required.");
      }
      const dispatch = {
        to: message.to,
        from: message.from || from,
        replyTo,
        subject: message.subject,
        html,
        ...(text === undefined ? {} : { text }),
      };
      if (delivery.type === "capture") {
        const directory = resolve(delivery.directory || ".local/emails");
        await mkdir(directory, { recursive: true, mode: 0o700 });
        const id = randomUUID();
        const path = join(directory, `${id}.html`);
        await writeFile(path, html, { mode: 0o600, flag: "wx" });
        await writeFile(
          join(directory, `${id}.json`),
          JSON.stringify(
            { ...dispatch, idempotencyKey: message.idempotencyKey },
            null,
            2,
          ),
          { mode: 0o600, flag: "wx" },
        );
        return { status: "captured", id, path };
      }
      if (!resend) throw new Error("Email delivery is not configured.");
      let result: Awaited<ReturnType<Resend["emails"]["send"]>>;
      try {
        result = await resend.emails.send(dispatch, {
          idempotencyKey: message.idempotencyKey,
        });
      } catch {
        throw new Error(
          "Email provider could not be reached. Delivery may be uncertain; retain the same idempotency key when retrying.",
        );
      }
      if (result.error) {
        // Provider error bodies can echo message contents. Return a bounded code only.
        const code = String(result.error.name)
          .replace(/[^a-zA-Z0-9_-]/g, "")
          .slice(0, 80);
        throw new Error(
          `Email provider rejected the request (${code || "unknown_error"}).`,
        );
      }
      if (!result.data?.id)
        throw new Error(
          "Email provider returned no message ID; delivery may be uncertain.",
        );
      return { status: "accepted", id: result.data.id };
    },
  };
}
