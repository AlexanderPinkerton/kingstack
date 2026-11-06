import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "@iarna/toml";
import { defineEmailConfig, authEmailKinds, type EmailConfig } from "./index";
import { renderAuthEmails } from "./auth";
import { EmailLayout } from "./react";
import { createMailer } from "./server";
import {
  exportAuthEmails,
  authEmailSettings,
  authVerificationPolicy,
  authEmailPlan,
  syncAuthEmails,
  syncAuthTemplates,
  setAuthVerificationPolicy,
  type AuthPatch,
  type AuthRequest,
} from "./supabase";
import { runCli } from "./cli";

const provider = vi.hoisted(() => ({ send: vi.fn(), constructed: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: provider.send };
    constructor(key: string) {
      provider.constructed(key);
    }
  },
}));
const config = defineEmailConfig({
  brand: { name: "Example Studio", accentColor: "#2563eb" },
  from: { name: "Example Studio", email: "support@example.com" },
  replyTo: "help@example.com",
});
const hosted = {
  projectRef: "abcdefghijklmnopqrst",
  siteUrl: "https://example.com",
  resendApiKey: "re_fixture-private-key",
};
const directories: string[] = [];
function temporary() {
  const directory = mkdtempSync(join(tmpdir(), "king-email-test-"));
  directories.push(directory);
  return directory;
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("email configuration and templates", () => {
  it("supports a hosted logo while retaining a text brand fallback", async () => {
    const result = await renderAuthEmails({
      ...config,
      brand: {
        ...config.brand,
        logo: { src: "https://example.com/logo.png", width: 240, height: 48 },
      },
    });
    expect(result.confirmation.html).toContain(
      'src="https://example.com/logo.png"',
    );
    expect(result.confirmation.html).toContain('alt="Example Studio"');
    expect(result.confirmation.html).toContain('width="240"');
    const plain = await renderAuthEmails(config);
    expect(plain.confirmation.html).toContain("Example Studio");
    expect(plain.confirmation.html).not.toContain("logo.png");
  });
  it("rejects unusable logo URLs and dimensions", () => {
    for (const logo of [
      { src: "/logo.png", width: 240, height: 48 },
      {
        src: "https://user:password@example.com/logo.png",
        width: 240,
        height: 48,
      },
      { src: "https://example.com/logo.png", width: 0, height: 48 },
    ])
      expect(() =>
        defineEmailConfig({ ...config, brand: { ...config.brand, logo } }),
      ).toThrow("logo");
  });
  it("supports token-hash callbacks and removes the obsolete browser restriction in previews too", async () => {
    const custom: EmailConfig = {
      ...config,
      auth: {
        actionUrls: {
          recovery:
            "{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery",
        },
      },
    };
    const result = await renderAuthEmails(custom);
    expect(result.recovery.html).toContain(
      "{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=recovery",
    );
    expect(result.recovery.html).not.toContain("browser where you started");
    expect(result.confirmation.html).toContain("{{ .ConfirmationURL }}");
    expect(result.confirmation.html).toContain("browser where you started");
    const preview = await renderAuthEmails(custom, { preview: true });
    expect(preview.recovery.html).toContain(
      "https://example.invalid/auth-preview",
    );
    expect(preview.recovery.html).not.toContain("{{");
    expect(preview.recovery.html).not.toContain("browser where you started");
  });
  it("rejects custom callbacks without a token hash or an origin-preserving prefix", async () => {
    for (const url of [
      "https://evil.example/{{ .TokenHash }}",
      "{{ .SiteURL }}evil.example/{{ .TokenHash }}",
      "{{ .RedirectTo }}evil.example/{{ .TokenHash }}",
      "{{ .SiteURL }}/no-token",
    ]) {
      await expect(
        renderAuthEmails({
          ...config,
          auth: { actionUrls: { recovery: url } },
        }),
      ).rejects.toThrow("action URL");
    }
  });
  it("requires custom token-hash templates to retain the token and supports helper-copy overrides", async () => {
    const custom: EmailConfig = {
      ...config,
      auth: {
        actionUrls: {
          recovery:
            "{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery",
        },
        copy: {
          recovery: { linkHint: "Open this secure link on any device." },
        },
      },
    };
    expect((await renderAuthEmails(custom)).recovery.html).toContain(
      "Open this secure link on any device.",
    );
    await expect(
      renderAuthEmails({
        ...custom,
        auth: {
          ...custom.auth,
          templates: { recovery: () => <p>Missing token</p> },
        },
      }),
    ).rejects.toThrow("must retain");
  });
  it("requires a sender and rejects header injection", () => {
    expect(() =>
      defineEmailConfig({ ...config, from: { email: "invalid" } }),
    ).toThrow("valid email");
    expect(() =>
      defineEmailConfig({
        ...config,
        from: {
          email: "support@example.com",
          name: "Sender\nBcc:other@example.com",
        },
      }),
    ).toThrow("sender name");
  });
  it.each(authEmailKinds)(
    "renders neutral, branded %s HTML with the provider credential intact",
    async (kind) => {
      const templates = await renderAuthEmails(config);
      expect(templates[kind].subject).toContain("Example Studio");
      expect(templates[kind].html).toContain("mailto:help@example.com");
      expect(templates[kind].html).not.toMatch(
        /Pinkerton|proposal|Scouter|\ufffd|\0/,
      );
      expect(templates[kind].html).toContain("{{ .SiteURL }}");
      expect(templates[kind].html).toContain(
        kind === "reauthentication"
          ? "{{ .Token }}"
          : 'href="{{ .ConfirmationURL }}"',
      );
      const preview = await renderAuthEmails(config, { preview: true });
      expect(preview[kind].html).not.toContain("{{");
    },
  );
  it("supports per-app copy without modifying other auth messages", async () => {
    const result = await renderAuthEmails({
      ...config,
      auth: {
        copy: {
          confirmation: {
            body: "Your school project is ready.",
            subject: "Confirm your account",
          },
        },
      },
    });
    expect(result.confirmation.html).toContain("Your school project is ready.");
    expect(result.confirmation.subject).toBe(
      "Confirm your account | Example Studio",
    );
    expect(result.recovery.html).not.toContain("school project");
  });
  it("supports custom React templates and rejects a missing auth action", async () => {
    const custom: EmailConfig = {
      ...config,
      auth: {
        templates: {
          recovery: ({ actionUrl }) => <a href={actionUrl}>Custom reset</a>,
        },
      },
    };
    expect((await renderAuthEmails(custom)).recovery.html).toContain(
      'href="{{ .ConfirmationURL }}"',
    );
    await expect(
      renderAuthEmails({
        ...config,
        auth: { templates: { recovery: () => <p>No action</p> } },
      }),
    ).rejects.toThrow("must retain");
  });
});

describe("delivery", () => {
  it("captures a custom React message with private files and no provider request", async () => {
    const directory = temporary();
    const mailer = createMailer({
      config,
      environment: "local",
      delivery: { type: "capture", directory },
    });
    const result = await mailer.send({
      to: "buyer@example.com",
      subject: "Welcome",
      react: (
        <EmailLayout brand={config.brand} preview="Welcome">
          <p>Hello recipient</p>
        </EmailLayout>
      ),
    });
    expect(result.status).toBe("captured");
    expect(provider.constructed).not.toHaveBeenCalled();
    expect(provider.send).not.toHaveBeenCalled();
    const saved = JSON.parse(
      readFileSync(join(directory, `${result.id}.json`), "utf8"),
    );
    expect(saved.html).toContain("Hello recipient");
    expect(saved.html).toMatch(/<body[^>]*color:#f4f4f5/);
    expect(saved.text).toContain("Hello recipient");
    expect(saved.replyTo).toBe("help@example.com");
    expect(statSync(join(directory, `${result.id}.html`)).mode & 0o777).toBe(
      0o600,
    );
    expect(statSync(join(directory, `${result.id}.json`)).mode & 0o777).toBe(
      0o600,
    );
  });
  it.each(["production", "development", "staging", ""])(
    'refuses capture in "%s"',
    (environment) => {
      expect(() =>
        createMailer({ config, environment, delivery: { type: "capture" } }),
      ).toThrow();
    },
  );
  it("cannot enable capture by mislabeling a production runtime as local", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() =>
      createMailer({
        config,
        environment: "local",
        delivery: { type: "capture" },
      }),
    ).toThrow("local and test");
  });
  it("fails on missing provider configuration", () => {
    expect(() =>
      createMailer({
        config,
        environment: "production",
        delivery: { type: "resend", apiKey: "" },
      }),
    ).toThrow("configured Resend key");
  });
  it("preserves the caller's dispatch and retry key, reporting accepted rather than delivered", async () => {
    provider.send.mockResolvedValue({
      data: { id: "provider-id" },
      error: null,
    });
    const mailer = createMailer({
      config,
      environment: "production",
      delivery: { type: "resend", apiKey: hosted.resendApiKey },
    });
    expect(
      await mailer.send({
        to: "buyer@example.com",
        from: "receipts@example.com",
        subject: "Receipt",
        html: "<p>Receipt</p>",
        idempotencyKey: "order/123",
      }),
    ).toEqual({ status: "accepted", id: "provider-id" });
    expect(provider.send).toHaveBeenCalledWith(
      {
        to: "buyer@example.com",
        from: "receipts@example.com",
        replyTo: "help@example.com",
        subject: "Receipt",
        html: "<p>Receipt</p>",
      },
      { idempotencyKey: "order/123" },
    );
  });
  it("does not expose provider responses containing credentials or private email contents", async () => {
    provider.send.mockResolvedValue({
      error: {
        name: "validation_error",
        message: "private token re_fixture-private-key",
      },
      data: null,
    });
    const mailer = createMailer({
      config,
      environment: "production",
      delivery: { type: "resend", apiKey: hosted.resendApiKey },
    });
    await expect(
      mailer.send({
        to: "buyer@example.com",
        subject: "Private",
        html: "private token",
      }),
    ).rejects.toThrow(
      /^Email provider rejected the request \(validation_error\)\.$/,
    );
    provider.send.mockRejectedValue(new Error("private network data"));
    await expect(
      mailer.send({
        to: "buyer@example.com",
        subject: "Private",
        html: "private token",
      }),
    ).rejects.toThrow("Delivery may be uncertain");
  });
  it("rejects malformed recipients before sending", async () => {
    const mailer = createMailer({
      config,
      environment: "production",
      delivery: { type: "resend", apiKey: hosted.resendApiKey },
    });
    await expect(
      mailer.send({ to: [], subject: "Hello", html: "Hi" }),
    ).rejects.toThrow("recipients");
    await expect(
      mailer.send({
        to: "buyer@example.com\nother@example.com",
        subject: "Hello",
        html: "Hi",
      }),
    ).rejects.toThrow("valid email");
    expect(provider.send).not.toHaveBeenCalled();
  });
});

describe("local export", () => {
  it("updates only managed templates, detects stale output, and preserves local policy", async () => {
    const cwd = temporary();
    mkdirSync(join(cwd, "supabase"));
    const original =
      '# Keep my comment\nproject_id = "example"\n[auth.email]\nenable_confirmations = false\n';
    writeFileSync(join(cwd, "supabase/config.toml"), original);
    await exportAuthEmails(config, { cwd });
    const saved = readFileSync(join(cwd, "supabase/config.toml"), "utf8");
    expect(saved.startsWith(original)).toBe(true);
    expect(saved).toContain("enable_confirmations = false");
    expect(parse(saved)).toHaveProperty("auth.email.template.confirmation");
    await exportAuthEmails(config, { cwd, check: true });
    writeFileSync(join(cwd, "supabase/templates/confirmation.html"), "stale");
    await expect(
      exportAuthEmails(config, { cwd, check: true }),
    ).rejects.toThrow("stale");
    expect(
      readFileSync(join(cwd, "supabase/templates/confirmation.html"), "utf8"),
    ).toBe("stale");
  });
  it("refuses unmanaged templates before writing any generated files", async () => {
    const cwd = temporary();
    mkdirSync(join(cwd, "supabase"));
    writeFileSync(
      join(cwd, "supabase/config.toml"),
      '[auth.email.template.confirmation]\nsubject = "Custom"\n',
    );
    await expect(exportAuthEmails(config, { cwd })).rejects.toThrow(
      "unmanaged",
    );
    expect(existsSync(join(cwd, "supabase/templates"))).toBe(false);
  });
  it("writes static previews without a Supabase project or optional CLI", async () => {
    const cwd = temporary();
    await exportAuthEmails(config, { cwd, preview: true });
    expect(readdirSync(join(cwd, ".local/auth-emails"))).toHaveLength(6);
    expect(
      readFileSync(join(cwd, ".local/auth-emails/confirmation.html"), "utf8"),
    ).toContain("https://example.invalid/auth-preview");
  });
});

describe("hosted settings", () => {
  it("publishes only the twelve template fields without SMTP credentials or policy changes", async () => {
    const cwd = temporary();
    const original = {
      smtp_host: "keep-host",
      smtp_pass: "keep-secret",
      site_url: "https://keep.example",
      mailer_autoconfirm: true,
      rate_limit_email_sent: 120,
    };
    let state: Record<string, unknown> = { ...original };
    const request = vi
      .fn<AuthRequest>()
      .mockImplementation((_project, _token, patch) => {
        if (patch) state = { ...state, ...patch };
        return Promise.resolve({ ...state });
      });
    const result = await syncAuthTemplates({
      cwd,
      config,
      environment: "production",
      projectRef: hosted.projectRef,
      token: "test-token",
      request,
      output: vi.fn(),
      apply: true,
    });
    const patch = request.mock.calls[1][2]!;
    expect(Object.keys(patch)).toHaveLength(12);
    expect(
      Object.keys(patch).every(
        (key) =>
          key.startsWith("mailer_subjects_") ||
          key.startsWith("mailer_templates_"),
      ),
    ).toBe(true);
    expect(state).toMatchObject(original);
    expect(readFileSync(result.backup!, "utf8")).not.toContain("keep-secret");
  });
  it("keeps SMTP/templates separate from auth policy and preserves unrelated settings", async () => {
    const current = {
      mailer_autoconfirm: true,
      external_google_enabled: true,
      uri_allow_list: "https://old.example.com",
      rate_limit_email_sent: 100,
    };
    const patch = authEmailSettings(
      current,
      config,
      hosted,
      await renderAuthEmails(config),
    );
    expect(patch).not.toHaveProperty("mailer_autoconfirm");
    expect(patch).not.toHaveProperty("mailer_allow_unverified_email_sign_ins");
    expect(patch).not.toHaveProperty("external_google_enabled");
    expect(patch.uri_allow_list).toContain("https://old.example.com");
    expect(patch.uri_allow_list).toContain(
      "https://example.com/auth/callback?**",
    );
    expect(patch.rate_limit_email_sent).toBe(100);
    expect(authVerificationPolicy()).toEqual({
      mailer_autoconfirm: false,
      mailer_allow_unverified_email_sign_ins: false,
    });
    expect(JSON.stringify(authEmailPlan(patch))).not.toContain(
      hosted.resendApiKey,
    );
    expect(JSON.stringify(authEmailPlan(patch))).not.toContain("<!DOCTYPE");
  });
  it("refuses unsafe site URLs, callback paths, and enabled email hooks", async () => {
    const templates = await renderAuthEmails(config);
    for (const siteUrl of [
      "http://example.com",
      "https://user:secret@example.com",
      "https://example.com/path",
      "https://example.com/?next=evil",
    ]) {
      expect(() =>
        authEmailSettings({}, config, { ...hosted, siteUrl }, templates),
      ).toThrow("canonical HTTPS");
    }
    expect(() =>
      authEmailSettings(
        {},
        { ...config, auth: { callbackPaths: ["//evil.example.com"] } },
        hosted,
        templates,
      ),
    ).toThrow("literal paths");
    expect(() =>
      authEmailSettings(
        { hook_send_email_enabled: true },
        config,
        hosted,
        templates,
      ),
    ).toThrow("Send Email hook");
  });
  it("defaults to read-only and does not create backups or write provider settings", async () => {
    const cwd = temporary();
    const request = vi.fn<AuthRequest>().mockResolvedValue({});
    const output = vi.fn();
    await syncAuthEmails({
      config,
      hosted,
      projectRef: hosted.projectRef,
      environment: "production",
      cwd,
      token: "test-token",
      request,
      output,
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(hosted.projectRef, "test-token");
    expect(existsSync(join(cwd, ".local"))).toBe(false);
    expect(JSON.stringify(output.mock.calls)).not.toContain(
      hosted.resendApiKey,
    );
  });
  it("backs up only affected settings privately and verifies an explicit apply", async () => {
    const cwd = temporary();
    let state: Record<string, unknown> = {
      smtp_pass: "old-private",
      external_google_enabled: true,
      mailer_autoconfirm: true,
    };
    const request = vi
      .fn<AuthRequest>()
      .mockImplementation((_project, _token, patch) => {
        if (patch) state = { ...state, ...patch };
        return Promise.resolve(state);
      });
    const output = vi.fn();
    const result = await syncAuthEmails({
      config,
      hosted,
      projectRef: hosted.projectRef,
      environment: "production",
      cwd,
      token: "test-token",
      request,
      output,
      apply: true,
    });
    expect(request).toHaveBeenCalledTimes(3);
    expect(state.mailer_autoconfirm).toBe(true);
    expect(state.external_google_enabled).toBe(true);
    expect(result.backup).toBeDefined();
    const backup = JSON.parse(readFileSync(result.backup!, "utf8"));
    expect(backup.settings.smtp_pass).toBe("old-private");
    expect(backup.settings).not.toHaveProperty("external_google_enabled");
    expect(statSync(result.backup!).mode & 0o777).toBe(0o600);
    expect(JSON.stringify(output.mock.calls)).not.toContain("old-private");
    expect(JSON.stringify(output.mock.calls)).not.toContain(
      hosted.resendApiKey,
    );
  });
  it("applies verification policy without modifying delivery or templates", async () => {
    let state: Record<string, unknown> = {
      smtp_host: "existing.example.com",
      mailer_autoconfirm: true,
    };
    let applied: AuthPatch | undefined;
    const request: AuthRequest = (_project, _token, patch) => {
      if (patch) {
        applied = patch;
        state = { ...state, ...patch };
      }
      return Promise.resolve(state);
    };
    await setAuthVerificationPolicy({
      environment: "production",
      projectRef: hosted.projectRef,
      cwd: temporary(),
      token: "test-token",
      request,
      output: vi.fn(),
      apply: true,
      requireVerification: true,
    });
    expect(applied).toEqual(authVerificationPolicy());
    expect(state.smtp_host).toBe("existing.example.com");
  });
  it("reports saved-setting mismatches instead of declaring success", async () => {
    const request = vi.fn<AuthRequest>().mockResolvedValue({});
    await expect(
      setAuthVerificationPolicy({
        environment: "production",
        projectRef: hosted.projectRef,
        cwd: temporary(),
        token: "test-token",
        request,
        output: vi.fn(),
        apply: true,
        requireVerification: true,
      }),
    ).rejects.toThrow("did not match");
  });
  it.each([
    ["auth", "sync"],
    ["auth", "export", "--apply"],
    ["auth", "sync", "--env", "production", "--require-verification"],
    ["auth", "policy", "--env", "production"],
    ["auth", "sync", "--env", "production", "--unknown"],
  ])(
    "rejects incomplete or ambiguous CLI arguments %j before touching configuration",
    async (...args) => {
      await expect(runCli(args)).rejects.toThrow();
    },
  );
});
