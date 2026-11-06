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
import { exportAuthEmails } from "./supabase";
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
      delivery: { type: "resend", apiKey: "re_fixture-private-key" },
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
      delivery: { type: "resend", apiKey: "re_fixture-private-key" },
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
      delivery: { type: "resend", apiKey: "re_fixture-private-key" },
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

describe("hosted command migration", () => {
  it.each(["sync", "policy", "templates"])(
    "redirects retired auth %s commands before loading config or making requests",
    async (action) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      try {
        await expect(
          runCli(["auth", action, "--env", "production", "--apply"]),
        ).rejects.toThrow("king-config sync");
        expect(fetch).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllGlobals();
      }
    },
  );
});
