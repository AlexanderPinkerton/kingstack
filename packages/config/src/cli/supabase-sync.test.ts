import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "@iarna/toml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncCommand } from "./sync";

const { run } = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("node:child_process", () => ({ spawnSync: run }));
const directories: string[] = [];
beforeEach(() => {
  run.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const cwd of directories.splice(0))
    rmSync(cwd, { recursive: true, force: true });
});
function fixture(
  options: { email?: boolean; mode?: string; provider?: boolean } = {},
) {
  const cwd = mkdtempSync(join(tmpdir(), "king-config-supabase-test-"));
  directories.push(cwd);
  mkdirSync(join(cwd, "config"));
  mkdirSync(join(cwd, "supabase"));
  const schema = {
    environments: {
      production: { mode: options.mode ?? "hosted", sync: true },
    },
    core: {
      PROJECT: { required: true },
      VERIFY: { default: "true" },
      ...(options.email ? { RESEND_API_KEY: { required: true } } : {}),
    },
    envfiles: {},
    configs: {
      supabase: {
        path: "supabase/config.toml",
        format: "toml",
        mappings: {
          project_id: "PROJECT",
          "auth.email.enable_confirmations": "VERIFY",
        },
      },
    },
    services:
      options.provider === false
        ? { github: { description: "GitHub", keys: ["PROJECT"] } }
        : {
            supabase: {
              provider: "supabase",
              description: "Supabase CLI",
              projectRef: "PROJECT",
              configFile: "supabase",
            },
          },
  };
  writeFileSync(
    join(cwd, "config/schema.ts"),
    `export const schema = { ...${JSON.stringify(schema)}, computed: () => ({}) };`,
  );
  writeFileSync(
    join(cwd, "config/production.ts"),
    `export const values = ${JSON.stringify({ PROJECT: "abcdefghijklmnopqrst", ...(options.email ? { RESEND_API_KEY: "private-fixture" } : {}) })};`,
  );
  let content =
    'project_id = "local-project"\n[api]\nenabled = false\n[auth.email]\nenable_confirmations = false\n';
  if (options.email) {
    mkdirSync(join(cwd, "emails"));
    writeFileSync(
      join(cwd, "emails/confirmation.html"),
      "<p>Verify fixture</p>",
    );
    content +=
      '[auth.email.smtp]\nenabled = true\npass = "env(RESEND_API_KEY)"\n[auth.email.template.confirmation]\nsubject = "Verify fixture"\ncontent_path = "./emails/confirmation.html"\n';
  }
  writeFileSync(join(cwd, "supabase/config.toml"), content);
  writeFileSync(join(cwd, ".env"), "RESEND_API_KEY=stale-local-key\n");
  writeFileSync(
    join(cwd, "supabase/.env"),
    "RESEND_API_KEY=stale-supabase-key\n",
  );
  return { cwd, content };
}
describe("Supabase CLI configuration sync", () => {
  it("includes the provider by default and ships selected settings and templates without switching local files", async () => {
    const { cwd, content } = fixture({ email: true });
    let temporary = "";
    run.mockImplementation((command, args, options) => {
      expect(command).toBe("supabase");
      temporary = args[args.indexOf("--workdir") + 1];
      expect(args).toEqual([
        "config",
        "push",
        "--workdir",
        temporary,
        "--project-ref",
        "abcdefghijklmnopqrst",
        "--yes",
      ]);
      expect(options.env.RESEND_API_KEY).toBe("private-fixture");
      expect(args.join(" ")).not.toContain("private-fixture");
      const rendered = readFileSync(
        join(temporary, "supabase/config.toml"),
        "utf8",
      );
      expect(parse(rendered)).toMatchObject({
        project_id: "abcdefghijklmnopqrst",
        api: { enabled: false },
        auth: {
          email: {
            enable_confirmations: true,
            smtp: { pass: "env(RESEND_API_KEY)" },
            template: { confirmation: { subject: "Verify fixture" } },
          },
        },
      });
      expect(rendered).not.toContain("private-fixture");
      expect(
        readFileSync(join(temporary, "emails/confirmation.html"), "utf8"),
      ).toBe("<p>Verify fixture</p>");
      expect(existsSync(join(temporary, ".env"))).toBe(false);
      expect(existsSync(join(temporary, "supabase/.env"))).toBe(false);
      expect(readFileSync(join(cwd, "supabase/config.toml"), "utf8")).toBe(
        content,
      );
      return { status: 0 };
    });
    expect(await syncCommand({ cwd, env: "production" })).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(existsSync(temporary)).toBe(false);
    expect(readFileSync(join(cwd, ".env"), "utf8")).toContain(
      "stale-local-key",
    );
  });
  it("supports a fresh project with no email package, custom templates, SMTP, or Resend credentials", async () => {
    const { cwd } = fixture();
    run.mockImplementation((_command, args, options) => {
      const directory = args[args.indexOf("--workdir") + 1];
      const rendered = readFileSync(
        join(directory, "supabase/config.toml"),
        "utf8",
      );
      expect(rendered).not.toContain("smtp");
      expect(rendered).not.toContain("template");
      expect(options.env.RESEND_API_KEY).toBe(process.env.RESEND_API_KEY);
      return { status: 0 };
    });
    expect(await syncCommand({ cwd, env: "production" })).toBe(true);
  });
  it("never invokes Supabase for schemas that have not declared that service", async () => {
    const { cwd } = fixture({ provider: false });
    expect(await syncCommand({ cwd, env: "production", dryRun: true })).toBe(
      true,
    );
    expect(run).not.toHaveBeenCalled();
  });
  it("preserves configured notification templates relative to the Supabase directory", async () => {
    const { cwd, content } = fixture();
    mkdirSync(join(cwd, "supabase/templates"));
    writeFileSync(
      join(cwd, "supabase/templates/security.html"),
      "<p>Security notification</p>",
    );
    writeFileSync(
      join(cwd, "supabase/config.toml"),
      content +
        '[auth.email.notification.password_changed]\nenabled = true\ncontent_path = "templates/security.html"\n',
    );
    run.mockImplementation((_command, args) => {
      const directory = args[args.indexOf("--workdir") + 1];
      expect(
        readFileSync(
          join(directory, "supabase/templates/security.html"),
          "utf8",
        ),
      ).toBe("<p>Security notification</p>");
      return { status: 0 };
    });
    expect(await syncCommand({ cwd, env: "production" })).toBe(true);
  });
  it("keeps previews offline and leaves generated files unchanged", async () => {
    const { cwd, content } = fixture({ email: true });
    expect(await syncCommand({ cwd, env: "production", dryRun: true })).toBe(
      true,
    );
    expect(run).not.toHaveBeenCalled();
    expect(readFileSync(join(cwd, "supabase/config.toml"), "utf8")).toBe(
      content,
    );
    expect(vi.mocked(console.log).mock.calls.flat().join("\n")).toContain(
      "1 configured email templates",
    );
  });
  it("fails before any provider writes when a referenced template is missing", async () => {
    const { cwd } = fixture({ email: true });
    rmSync(join(cwd, "emails/confirmation.html"));
    expect(await syncCommand({ cwd, env: "production" })).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
  it("refuses local targets", async () => {
    const { cwd } = fixture({ mode: "local" });
    expect(await syncCommand({ cwd, env: "production" })).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
  it("propagates CLI failures and cleans up temporary configuration", async () => {
    const { cwd, content } = fixture();
    let temporary = "";
    run.mockImplementation((_command, args) => {
      temporary = args[args.indexOf("--workdir") + 1];
      return { status: 1 };
    });
    expect(await syncCommand({ cwd, env: "production" })).toBe(false);
    expect(existsSync(temporary)).toBe(false);
    expect(readFileSync(join(cwd, "supabase/config.toml"), "utf8")).toBe(
      content,
    );
  });
});
