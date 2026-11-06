import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncCommand } from "./sync";
import {
  resolveSupabaseAuthSettings,
  type SupabaseAuthServiceConfig,
} from "../supabase-auth";

const { run, request, token } = vi.hoisted(() => ({
  run: vi.fn(),
  request: vi.fn(),
  token: vi.fn(),
}));
vi.mock("node:child_process", () => ({ spawnSync: run }));
vi.mock("./supabase-management", () => ({
  authManagementRequest: request,
  supabaseManagementToken: token,
}));

const service: SupabaseAuthServiceConfig = {
  provider: "supabase-auth",
  description: "Hosted auth",
  projectRef: "PROJECT",
  mappings: {
    site_url: "SITE",
    smtp_host: "HOST",
    smtp_port: "PORT",
    smtp_pass: "SECRET",
    rate_limit_email_sent: "LIMIT",
    mailer_autoconfirm: "AUTO",
    mailer_secure_email_change_enabled: "DOUBLE",
  },
};
const values = {
  PROJECT: "abcdefghijklmnopqrst",
  SITE: "https://example.com",
  HOST: "smtp.resend.com",
  PORT: "465",
  SECRET: "re_private_fixture",
  LIMIT: "30",
  AUTO: "false",
  DOUBLE: "false",
};
const directories: string[] = [];
let state: Record<string, unknown>;
beforeEach(() => {
  run.mockReset();
  request.mockReset();
  token.mockReset();
  token.mockReturnValue("sbp_fixture");
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  state = {
    smtp_pass: "old_private",
    mailer_autoconfirm: true,
    external_google_enabled: true,
    mailer_templates_confirmation_content: "KEEP TEMPLATE",
    uri_allow_list: "https://keep.example/callback",
  };
  request.mockImplementation((_project, _token, patch) => {
    if (patch) state = { ...state, ...patch };
    return Promise.resolve({ ...state });
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture(
  overrides: Partial<typeof values> = {},
  mapping = service,
  mode = "hosted",
) {
  const cwd = mkdtempSync(join(tmpdir(), "king-config-auth-"));
  directories.push(cwd);
  mkdirSync(join(cwd, "config"));
  writeFileSync(
    join(cwd, "config/schema.ts"),
    `export const schema = ${JSON.stringify({ environments: { production: { mode, sync: true } }, core: Object.fromEntries(Object.keys(values).map((key) => [key, { required: true }])), envfiles: {}, services: { supabase: mapping } }).replace('"envfiles":{}', '"computed":()=>({}),"envfiles":{}')};`,
  );
  writeFileSync(
    join(cwd, "config/production.ts"),
    `export const values = ${JSON.stringify({ ...values, ...overrides })};`,
  );
  return cwd;
}

describe("Supabase Auth in normal config sync", () => {
  it("includes the declared provider by default and never changes templates or unmapped settings", async () => {
    const cwd = fixture();
    expect(await syncCommand({ cwd, env: "production" })).toBe(true);
    const patch = request.mock.calls[1]?.[2];
    expect(patch).toMatchObject({
      smtp_pass: values.SECRET,
      smtp_port: "465",
      rate_limit_email_sent: 30,
      mailer_autoconfirm: false,
      mailer_secure_email_change_enabled: false,
    });
    expect(Object.keys(patch)).toEqual(Object.keys(service.mappings));
    expect(state.mailer_templates_confirmation_content).toBe("KEEP TEMPLATE");
    expect(state.external_google_enabled).toBe(true);
    expect(state.uri_allow_list).toBe("https://keep.example/callback");
    expect(run).not.toHaveBeenCalled();
    const directory = join(cwd, ".local/config-backups");
    const backup = join(
      directory,
      readdirSync(directory).find((name) => name.endsWith(".json"))!,
    );
    expect(readFileSync(join(directory, ".gitignore"), "utf8")).toContain("*");
    expect(statSync(backup).mode & 0o777).toBe(0o600);
    const saved = JSON.parse(readFileSync(backup, "utf8"));
    expect(saved.settings.smtp_pass).toBe("old_private");
    expect(saved.settings).not.toHaveProperty(
      "mailer_templates_confirmation_content",
    );
    const output = [
      ...vi.mocked(console.log).mock.calls,
      ...vi.mocked(console.error).mock.calls,
    ]
      .flat()
      .join("\n");
    for (const secret of [values.SECRET, "old_private", "sbp_fixture"])
      expect(output).not.toContain(secret);
    expect(output).toContain("Management API");
    expect(output).toContain("templates are published separately");
  });
  it("keeps dry runs offline without reading credentials or writing backups", async () => {
    const cwd = fixture();
    expect(await syncCommand({ cwd, env: "production", dryRun: true })).toBe(
      true,
    );
    expect(request).not.toHaveBeenCalled();
    expect(token).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(existsSync(join(cwd, ".local"))).toBe(false);
    const output = vi.mocked(console.log).mock.calls.flat().join("\n");
    expect(output).toContain("mailer_autoconfirm: false");
    expect(output).toContain("rate_limit_email_sent: 30");
    expect(output).not.toContain(values.SECRET);
  });
  it.each([
    { AUTO: "yes" },
    { LIMIT: "-1" },
    { PORT: "70000" },
    { PROJECT: "not-a-project" },
    { SITE: "http://example.com" },
  ])(
    "rejects invalid settings before any provider mutation: %j",
    async (overrides) => {
      expect(
        await syncCommand({ cwd: fixture(overrides), env: "production" }),
      ).toBe(false);
      expect(request).not.toHaveBeenCalled();
      expect(run).not.toHaveBeenCalled();
    },
  );
  it("refuses template fields in the config provider", async () => {
    const unsafe = {
      ...service,
      mappings: {
        ...service.mappings,
        mailer_templates_confirmation_content: "SECRET",
      },
    };
    expect(
      await syncCommand({ cwd: fixture({}, unsafe), env: "production" }),
    ).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  it("refuses hosted sync for a local environment", async () => {
    expect(
      await syncCommand({
        cwd: fixture({}, service, "local"),
        env: "production",
      }),
    ).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  it("reports failed verification instead of a successful sync", async () => {
    request.mockResolvedValue({});
    expect(await syncCommand({ cwd: fixture(), env: "production" })).toBe(
      false,
    );
    expect(vi.mocked(console.error).mock.calls.flat().join("\n")).toContain(
      "Saved Auth setting did not match",
    );
  });
  it("requires login explicitly and never reports success after a provider error", async () => {
    token.mockImplementation(() => {
      throw new Error("Run yarn supabase login");
    });
    expect(await syncCommand({ cwd: fixture(), env: "production" })).toBe(
      false,
    );
    expect(request).not.toHaveBeenCalled();
    expect(vi.mocked(console.error).mock.calls.flat().join("\n")).toContain(
      "supabase login",
    );
  });
  it("refuses SMTP changes when a send-email hook owns delivery", async () => {
    state.hook_send_email_enabled = true;
    expect(await syncCommand({ cwd: fixture(), env: "production" })).toBe(
      false,
    );
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("converts exact string booleans and permits an explicit empty redirect allowlist", () => {
    expect(
      resolveSupabaseAuthSettings(
        {
          ...service,
          mappings: { uri_allow_list: "URLS", mailer_autoconfirm: "AUTO" },
        },
        { ...values, URLS: "" },
      ).settings,
    ).toEqual({ uri_allow_list: "", mailer_autoconfirm: false });
  });
});
