import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { loadResolvedEnvironment } from "@kingstack/config";
import type { AuthConfigCliOptions } from "./auth-options.js";

const MANAGEMENT_API_URL = "https://api.supabase.com/v1";
const REQUEST_TIMEOUT_MS = 30_000;
const SUPABASE_CLI_KEYCHAIN_SERVICE = "Supabase CLI";
const SUPABASE_CLI_KEYCHAIN_ACCOUNTS = ["supabase", "access-token"];

export interface HostedAuthPlan {
  environment?: string;
  projectRef: string;
  siteUrl: string;
  requireEmailConfirmation: boolean;
  enableAnonymousSignIns: boolean;
}

export interface HostedAuthConfig {
  siteUrl: string;
  emailConfirmationRequired: boolean;
  anonymousSignInsEnabled: boolean;
}

interface AuthApiResponse {
  site_url?: unknown;
  mailer_autoconfirm?: unknown;
  external_anonymous_users_enabled?: unknown;
}

export type AuthConfigFetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export async function resolveHostedAuthPlan(
  options: AuthConfigCliOptions,
  projectRoot?: string,
): Promise<HostedAuthPlan> {
  let projectRef = options.projectRef;
  let siteUrl = options.siteUrl;

  if (options.environment) {
    if (!projectRoot) {
      throw new Error(
        "A KingStack project root is required for an environment.",
      );
    }
    const resolved = await loadEnvironmentConfig(
      options.environment,
      projectRoot,
    );
    projectRef ||= stringValue(resolved.SUPABASE_PROJECT_REF);
    siteUrl ||= stringValue(resolved.NEXT_URL);
  }

  if (!projectRef || !siteUrl) {
    throw new Error(
      "Provide a hosted config environment, or provide both --project-ref and --site-url.",
    );
  }

  return {
    environment: options.environment,
    projectRef: validateProjectRef(projectRef),
    siteUrl: normalizeHostedSiteUrl(siteUrl),
    requireEmailConfirmation: options.requireEmailConfirmation,
    enableAnonymousSignIns: options.enableAnonymousSignIns,
  };
}

export function validateProjectRef(value: string): string {
  const ref = value.trim().toLowerCase();
  if (!/^[a-z0-9]{20}$/.test(ref)) {
    throw new Error(
      `Invalid Supabase project reference "${value}"; expected 20 lowercase letters or numbers.`,
    );
  }
  return ref;
}

export function normalizeHostedSiteUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error(`Invalid hosted Site URL "${value}".`, { cause: error });
  }
  if (url.protocol !== "https:") {
    throw new Error(
      `Hosted Supabase Auth requires an HTTPS Site URL; received ${value}.`,
    );
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      "The hosted Supabase Site URL cannot contain credentials, a query, or a fragment.",
    );
  }
  return url.href.replace(/\/$/, "");
}

export function desiredHostedAuthConfig(
  plan: HostedAuthPlan,
): HostedAuthConfig {
  return {
    siteUrl: plan.siteUrl,
    emailConfirmationRequired: plan.requireEmailConfirmation,
    anonymousSignInsEnabled: plan.enableAnonymousSignIns,
  };
}

export function authConfigMatches(
  actual: HostedAuthConfig,
  desired: HostedAuthConfig,
): boolean {
  return (
    normalizeComparableUrl(actual.siteUrl) ===
      normalizeComparableUrl(desired.siteUrl) &&
    actual.emailConfirmationRequired === desired.emailConfirmationRequired &&
    actual.anonymousSignInsEnabled === desired.anonymousSignInsEnabled
  );
}

export async function resolveSupabaseAccessToken(): Promise<string> {
  const environmentToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (environmentToken) return environmentToken;

  try {
    const { Entry } = await import("@napi-rs/keyring");
    for (const account of SUPABASE_CLI_KEYCHAIN_ACCOUNTS) {
      try {
        const keychainToken = new Entry(
          SUPABASE_CLI_KEYCHAIN_SERVICE,
          account,
        ).getPassword();
        if (keychainToken?.trim()) return keychainToken.trim();
      } catch {
        // This account may not exist in the system keyring.
      }
    }
  } catch {
    // This operating system may not provide a supported keyring.
  }

  const supabaseHome =
    process.env.SUPABASE_HOME?.trim() || join(homedir(), ".supabase");
  const tokenPath = join(supabaseHome, "access-token");
  if (existsSync(tokenPath)) {
    const fileToken = readFileSync(tokenPath, "utf8").trim();
    if (fileToken) return fileToken;
  }

  throw new Error(
    "No Supabase Management API token was found. Run `yarn exec supabase login`, or provide SUPABASE_ACCESS_TOKEN in the process environment.",
  );
}

export async function getHostedAuthConfig(
  projectRef: string,
  accessToken: string,
  fetcher: AuthConfigFetcher = fetch,
): Promise<HostedAuthConfig> {
  const response = await authRequest(
    projectRef,
    accessToken,
    { method: "GET" },
    fetcher,
  );
  return parseHostedAuthConfig(response);
}

export async function updateHostedAuthConfig(
  plan: HostedAuthPlan,
  accessToken: string,
  fetcher: AuthConfigFetcher = fetch,
): Promise<HostedAuthConfig> {
  await authRequest(
    plan.projectRef,
    accessToken,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        site_url: plan.siteUrl,
        mailer_autoconfirm: !plan.requireEmailConfirmation,
        external_anonymous_users_enabled: plan.enableAnonymousSignIns,
      }),
    },
    fetcher,
  );

  const verified = await getHostedAuthConfig(
    plan.projectRef,
    accessToken,
    fetcher,
  );
  const desired = desiredHostedAuthConfig(plan);
  if (!authConfigMatches(verified, desired)) {
    throw new Error(
      "Supabase accepted the Auth update, but the verification response does not match the requested settings.",
    );
  }
  return verified;
}

export function parseHostedAuthConfig(value: unknown): HostedAuthConfig {
  if (!isRecord(value)) {
    throw new Error(
      "Supabase Management API returned an unexpected Auth configuration response.",
    );
  }
  const response = value as AuthApiResponse;
  if (
    typeof response.site_url !== "string" ||
    typeof response.mailer_autoconfirm !== "boolean" ||
    typeof response.external_anonymous_users_enabled !== "boolean"
  ) {
    throw new Error(
      "Supabase Auth configuration is missing site_url, mailer_autoconfirm, or external_anonymous_users_enabled.",
    );
  }
  return {
    siteUrl: response.site_url,
    emailConfirmationRequired: !response.mailer_autoconfirm,
    anonymousSignInsEnabled: response.external_anonymous_users_enabled,
  };
}

async function loadEnvironmentConfig(
  environment: string,
  projectRoot: string,
): Promise<Record<string, string>> {
  const schemaPath = resolve(projectRoot, "config/schema.ts");
  const valuesPath = resolve(projectRoot, `config/${environment}.ts`);
  if (!existsSync(schemaPath) || !existsSync(valuesPath)) {
    throw new Error(
      `Run from a KingStack project root with config/schema.ts and config/${environment}.ts.`,
    );
  }

  const result = await loadResolvedEnvironment(environment, projectRoot);
  const { schema } = result;

  const definition = schema.environments?.[environment];
  if (!definition || definition.mode !== "hosted") {
    throw new Error(
      `Environment "${environment}" must be declared as hosted in config/schema.ts.`,
    );
  }

  if (result.errors.length > 0) {
    throw new Error(
      `Configuration is invalid:\n${result.errors.map((error) => `- ${error.key}: ${error.message}`).join("\n")}`,
    );
  }
  return result.config.all;
}

async function authRequest(
  projectRefValue: string,
  accessToken: string,
  init: RequestInit,
  fetcher: AuthConfigFetcher,
): Promise<unknown> {
  const projectRef = validateProjectRef(projectRefValue);
  let response: Response;
  try {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${accessToken}`);
    headers.set("accept", "application/json");
    response = await fetcher(
      `${MANAGEMENT_API_URL}/projects/${encodeURIComponent(projectRef)}/config/auth`,
      {
        ...init,
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
  } catch (error) {
    throw new Error(
      "Could not reach the Supabase Management API. Check the network connection and retry.",
      { cause: error },
    );
  }

  const text = await response.text();
  let body: unknown;
  try {
    body = text ? (JSON.parse(text) as unknown) : {};
  } catch {
    body = {};
  }
  if (!response.ok) {
    const detail = apiErrorMessage(body);
    throw new Error(
      `Supabase Auth configuration request failed (${response.status})${detail ? `: ${detail}` : "."}`,
    );
  }
  return body;
}

function apiErrorMessage(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  for (const key of ["message", "error", "msg"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate
        .trim()
        .replace(/[\r\n]+/g, " ")
        .slice(0, 500);
    }
  }
  return undefined;
}

function normalizeComparableUrl(value: string): string {
  try {
    return new URL(value).href.replace(/\/$/, "");
  } catch {
    return value.replace(/\/$/, "");
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
