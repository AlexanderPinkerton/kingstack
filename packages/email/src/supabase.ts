import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { renderAuthEmails } from "./auth";
import {
  authEmailSettings,
  authEmailPlan,
  authVerificationPolicy,
  type AuthPatch,
  type AuthSettings,
} from "./settings";
import { authManagementRequest, supabaseManagementToken } from "./management";
import type { EmailConfig, HostedEmailEnvironment } from "./types";

export {
  authEmailSettings,
  authEmailPlan,
  authVerificationPolicy,
} from "./settings";
export type { AuthSettings, AuthPatch } from "./settings";
export { exportAuthEmails } from "./files";
export { authManagementRequest, supabaseManagementToken } from "./management";

export type AuthRequest = (
  project: string,
  token: string,
  patch?: AuthPatch,
) => Promise<AuthSettings>;
interface SyncOptions {
  environment: string;
  projectRef: string;
  cwd?: string;
  apply?: boolean;
  token?: string;
  request?: AuthRequest;
  output?: (message: string) => void;
}

async function syncSettings(
  options: SyncOptions,
  build: (current: AuthSettings) => AuthPatch,
) {
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(options.environment) ||
    ["local", "test"].includes(options.environment)
  ) {
    throw new Error(
      "Select an explicit hosted environment, such as development or production.",
    );
  }
  if (!/^[a-z0-9]{20}$/.test(options.projectRef))
    throw new Error("Invalid Supabase project reference.");
  const request = options.request || authManagementRequest;
  const output = options.output || console.log;
  const token = options.token || supabaseManagementToken();
  const current = await request(options.projectRef, token);
  const patch = build(current);
  const plan = {
    environment: options.environment,
    project: options.projectRef,
    apply: options.apply === true,
    settings: authEmailPlan(patch),
  };
  output(JSON.stringify(plan, null, 2));
  if (!options.apply) return { plan };
  const directory = resolve(
    options.cwd || process.cwd(),
    ".local/auth-email-backups",
  );
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const backup = resolve(
    directory,
    `${options.environment}-${Date.now()}-${randomUUID()}.json`,
  );
  const savedSettings: AuthSettings = {};
  for (const key of Object.keys(patch))
    savedSettings[key] = current[key] ?? null;
  writeFileSync(
    backup,
    JSON.stringify(
      { project: options.projectRef, settings: savedSettings },
      null,
      2,
    ),
    { mode: 0o600, flag: "wx" },
  );
  output(
    `Private rollback snapshot: ${backup}. It may contain SMTP credentials.`,
  );
  await request(options.projectRef, token, patch);
  const saved = await request(options.projectRef, token);
  for (const [key, value] of Object.entries(patch)) {
    if (key !== "smtp_pass" && saved[key] !== value)
      throw new Error(
        `Saved Auth setting did not match for ${key}. Review the project before sending.`,
      );
  }
  output(
    `${options.environment}: requested settings applied and verified. No emails sent by this command.`,
  );
  return { plan, backup };
}

export async function syncAuthEmails(
  options: SyncOptions & {
    config: EmailConfig;
    hosted: HostedEmailEnvironment;
  },
) {
  if (options.hosted.projectRef !== options.projectRef)
    throw new Error("Hosted email project does not match the selected target.");
  const templates = await renderAuthEmails(options.config);
  return syncSettings(options, (current) =>
    authEmailSettings(current, options.config, options.hosted, templates),
  );
}
export async function setAuthVerificationPolicy(
  options: SyncOptions & { requireVerification: true },
) {
  if (options.requireVerification !== true)
    throw new Error("Explicit requireVerification is required.");
  return syncSettings(options, authVerificationPolicy);
}
