/** Auth service settings supported by config sync. Email content is deliberately separate. */
export const supabaseAuthSettingTypes = {
  site_url: "string",
  uri_allow_list: "string",
  smtp_host: "string",
  smtp_port: "port",
  smtp_user: "string",
  smtp_pass: "secret",
  smtp_admin_email: "string",
  smtp_sender_name: "string",
  rate_limit_email_sent: "integer",
  smtp_max_frequency: "integer",
  mailer_autoconfirm: "boolean",
  mailer_allow_unverified_email_sign_ins: "boolean",
  mailer_secure_email_change_enabled: "boolean",
  mailer_otp_exp: "integer",
  mailer_otp_length: "integer",
  security_update_password_require_reauthentication: "boolean",
  disable_signup: "boolean",
  external_anonymous_users_enabled: "boolean",
} as const;

export type SupabaseAuthSetting = keyof typeof supabaseAuthSettingTypes;
export interface SupabaseAuthServiceConfig {
  provider: "supabase-auth";
  description: string;
  /** Resolved configuration key containing the hosted project reference. */
  projectRef: string;
  /** Management API field to resolved configuration key. Only these fields are managed. */
  mappings: Partial<Record<SupabaseAuthSetting, string>>;
}
export type SupabaseAuthPatch = Record<string, string | number | boolean>;

export function resolveSupabaseAuthSettings(
  service: SupabaseAuthServiceConfig,
  config: Record<string, string>,
): { project: string; settings: SupabaseAuthPatch } {
  const project = config[service.projectRef];
  if (!/^[a-z0-9]{20}$/.test(project ?? ""))
    throw new Error(
      `Supabase sync requires a valid project reference in ${service.projectRef}`,
    );
  const settings: SupabaseAuthPatch = {};
  for (const [field, key] of Object.entries(service.mappings)) {
    if (!Object.hasOwn(supabaseAuthSettingTypes, field))
      throw new Error(
        `Unsupported Supabase Auth setting: ${field}. Publish email templates separately.`,
      );
    const value = config[key];
    if (value === undefined || (value === "" && field !== "uri_allow_list"))
      throw new Error(`Supabase Auth setting ${field} requires ${key}`);
    const type = supabaseAuthSettingTypes[field as SupabaseAuthSetting];
    if (type === "boolean") {
      if (value !== "true" && value !== "false")
        throw new Error(`${key} must be true or false for ${field}`);
      settings[field] = value === "true";
    } else if (type === "integer" || type === "port") {
      const number = Number(value);
      if (
        !/^\d+$/.test(value) ||
        !Number.isSafeInteger(number) ||
        (type === "port" && (number < 1 || number > 65535))
      )
        throw new Error(`${key} must be a valid ${type} for ${field}`);
      settings[field] = type === "port" ? String(number) : number;
    } else {
      if (/[\r\n\0]/.test(value))
        throw new Error(`${key} must be a single-line value`);
      settings[field] = value;
    }
  }
  if (Object.keys(settings).length === 0)
    throw new Error("Supabase Auth sync requires at least one mapping");
  if (typeof settings.site_url === "string") {
    let site: URL;
    try {
      site = new URL(settings.site_url);
    } catch {
      throw new Error("Supabase site_url must be a canonical HTTPS origin");
    }
    if (
      site.protocol !== "https:" ||
      site.username ||
      site.password ||
      site.search ||
      site.hash ||
      site.pathname !== "/"
    )
      throw new Error("Supabase site_url must be a canonical HTTPS origin");
  }
  return { project, settings };
}
