import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Entry } from "@napi-rs/keyring";
import {
  resolveConfig,
  type ConfigSchema,
  type ConfigValues,
} from "@kingstack/config";
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
}

export interface HostedAuthConfig {
  siteUrl: string;
  emailConfirmationRequired: boolean;
}

interface AuthApiResponse {
  site_url?: unknown;
  mailer_autoconfirm?: unknown;
}

export type AuthConfigFetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export async function resolveHostedAuthPlan(
  options: AuthConfigCliOptions,
): Promise<HostedAuthPlan> {
  let projectRef = options.projectRef;
  let siteUrl = options.siteUrl;

  if (options.environment) {
    const resolved = await loadEnvironmentConfig(options.environment);
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
  };
}

export function authConfigMatches(
  actual: HostedAuthConfig,
  desired: HostedAuthConfig,
): boolean {
  return (
    normalizeComparableUrl(actual.siteUrl) ===
      normalizeComparableUrl(desired.siteUrl) &&
    actual.emailConfirmationRequired === desired.emailConfirmationRequired
  );
}

export function resolveSupabaseAccessToken(): string {
  const environmentToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (environmentToken) return environmentToken;

  for (const account of SUPABASE_CLI_KEYCHAIN_ACCOUNTS) {
    try {
      const keychainToken = new Entry(
        SUPABASE_CLI_KEYCHAIN_SERVICE,
        account,
      ).getPassword();
      if (keychainToken?.trim()) return keychainToken.trim();
    } catch {
      // The account may not exist, or the system may not provide a keyring.
    }
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
    typeof response.mailer_autoconfirm !== "boolean"
  ) {
    throw new Error(
      "Supabase Auth configuration is missing site_url or mailer_autoconfirm.",
    );
  }
  return {
    siteUrl: response.site_url,
    emailConfirmationRequired: !response.mailer_autoconfirm,
  };
}

async function loadEnvironmentConfig(
  environment: string,
): Promise<Record<string, string>> {
  const schemaPath = resolve("config/schema.ts");
  const valuesPath = resolve(`config/${environment}.ts`);
  if (!existsSync(schemaPath) || !existsSync(valuesPath)) {
    throw new Error(
      `Run from a KingStack project root with config/schema.ts and config/${environment}.ts.`,
    );
  }

  const schemaModule = (await import(pathToFileURL(schemaPath).href)) as {
    schema?: ConfigSchema;
  };
  const valuesModule = (await import(pathToFileURL(valuesPath).href)) as {
    values?: ConfigValues;
  };
  if (!schemaModule.schema) {
    throw new Error("config/schema.ts exports no schema.");
  }
  if (!valuesModule.values) {
    throw new Error(`config/${environment}.ts exports no values.`);
  }

  const definition = schemaModule.schema.environments?.[environment];
  if (!definition || definition.mode !== "hosted") {
    throw new Error(
      `Environment "${environment}" must be declared as hosted in config/schema.ts.`,
    );
  }

  const result = resolveConfig(schemaModule.schema, valuesModule.values, {
    environment,
  });
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
