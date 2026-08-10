import { createInterface, type Interface } from "node:readline/promises";
import { loadUserSchema, type ConfigSchema } from "@kingstack/config";
import {
  authConfigMatches,
  desiredHostedAuthConfig,
  getHostedAuthConfig,
  resolveHostedAuthPlan,
  resolveSupabaseAccessToken,
  updateHostedAuthConfig,
  type HostedAuthConfig,
  type HostedAuthPlan,
} from "./auth-config.js";
import {
  formatAuthConfigHelp,
  parseAuthConfigCliArgs,
  type AuthConfigCliOptions,
} from "./auth-options.js";
import { choose } from "./provision.js";
import type { KingStackProject } from "../project.js";

export async function runSupabaseAuthCli(
  args: string[],
  project: KingStackProject,
): Promise<void> {
  let options = parseAuthConfigCliArgs(args);
  if (options.help) {
    console.log(formatAuthConfigHelp());
    return;
  }

  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const interface_ = interactive
    ? createInterface({ input: process.stdin, output: process.stdout })
    : undefined;

  try {
    const schema = await loadUserSchema(project.root);
    options = await resolveEnvironment(options, interface_, schema);
    const plan = await resolveHostedAuthPlan(options, project.root);
    printPlan(plan);

    if (options.dryRun) {
      console.log();
      console.log("Dry run complete; no Supabase settings were changed.");
      return;
    }

    const accessToken = await resolveSupabaseAccessToken();
    const current = await getHostedAuthConfig(plan.projectRef, accessToken);
    printCurrent(current);
    const desired = desiredHostedAuthConfig(plan);
    if (authConfigMatches(current, desired)) {
      console.log();
      console.log("Supabase Auth is already configured as requested.");
      return;
    }

    await confirmUpdate(interface_, options.yes);
    const verified = await updateHostedAuthConfig(plan, accessToken);
    console.log();
    console.log("Updated and verified Supabase Auth configuration.");
    console.log(`Site URL:           ${verified.siteUrl}`);
    console.log(
      `Email confirmation: ${confirmationDescription(verified.emailConfirmationRequired)}`,
    );
    console.log(
      `Guest sessions:     ${guestDescription(verified.anonymousSignInsEnabled)}`,
    );
    console.log();
    console.log(
      "New signups and guest sessions now follow these settings. Existing confirmation links are not rewritten.",
    );
  } finally {
    interface_?.close();
  }
}

async function resolveEnvironment(
  options: AuthConfigCliOptions,
  interface_: Interface | undefined,
  schema: ConfigSchema,
): Promise<AuthConfigCliOptions> {
  if (options.environment || (options.projectRef && options.siteUrl)) {
    return options;
  }
  if (!interface_) {
    throw new Error(
      "Non-interactive use requires an environment, or both --project-ref and --site-url.",
    );
  }

  const environments = Object.entries(schema.environments ?? {})
    .filter(([, definition]) => definition.mode === "hosted")
    .map(([environment, definition]) => ({
      label: `${environment} — ${definition.description || "Hosted deployment"}`,
      value: environment,
    }));
  if (environments.length === 0) {
    throw new Error("config/schema.ts declares no hosted environments.");
  }
  const productionIndex = Math.max(
    0,
    environments.findIndex(({ value }) => value === "production"),
  );
  const environment = await choose(
    interface_,
    "Which hosted KingStack environment should configure Supabase Auth?",
    environments,
    productionIndex,
  );
  return { ...options, environment };
}

function printPlan(plan: HostedAuthPlan): void {
  console.log();
  console.log("KingStack hosted Supabase Auth configuration");
  if (plan.environment) console.log(`Environment:        ${plan.environment}`);
  console.log(`Project:            ${plan.projectRef}`);
  console.log(`Site URL:           ${plan.siteUrl}`);
  console.log(
    `Email confirmation: ${confirmationDescription(plan.requireEmailConfirmation)}`,
  );
  console.log(
    `Guest sessions:     ${guestDescription(plan.enableAnonymousSignIns)}`,
  );
  console.log();
  console.log(
    "Only site_url, mailer_autoconfirm, and external_anonymous_users_enabled will be changed; other Auth settings are preserved.",
  );
  if (!plan.requireEmailConfirmation) {
    console.log(
      "Security tradeoff: immediate signup does not prove ownership of the supplied email address.",
    );
  }
}

function printCurrent(current: HostedAuthConfig): void {
  console.log();
  console.log("Current hosted settings:");
  console.log(`Site URL:           ${current.siteUrl}`);
  console.log(
    `Email confirmation: ${confirmationDescription(current.emailConfirmationRequired)}`,
  );
  console.log(
    `Guest sessions:     ${guestDescription(current.anonymousSignInsEnabled)}`,
  );
}

function confirmationDescription(required: boolean): string {
  return required ? "required" : "disabled (immediate signup)";
}

function guestDescription(enabled: boolean): string {
  return enabled ? "enabled (temporary anonymous users)" : "disabled";
}

async function confirmUpdate(
  interface_: Interface | undefined,
  yes: boolean,
): Promise<void> {
  if (yes) return;
  if (!interface_) {
    throw new Error("Non-interactive Supabase Auth updates require --yes.");
  }
  const answer = (
    await interface_.question(
      "Apply these hosted Supabase Auth settings? [y/N] ",
    )
  ).trim();
  if (!/^y(?:es)?$/i.test(answer)) throw new Error("Cancelled.");
}
