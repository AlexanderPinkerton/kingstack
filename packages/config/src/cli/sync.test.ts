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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncCommand } from "./sync";

const { run } = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("node:child_process", () => ({ spawnSync: run }));

describe("Vercel environment sync", () => {
  const directories: string[] = [];
  const privateValues = {
    STRIPE_SECRET_KEY: "sk_live_PrivateFixture",
    SUPABASE_DB_POOL_URL: "postgresql://fixture:private@localhost/db",
    RESEND_API_KEY: "re_PrivateFixture",
  };

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    run.mockReset();
    run.mockImplementation((_command: string, args: string[]) => {
      if (args[0] === "--version")
        return { status: 0, stdout: "Vercel CLI 65.10.0" };
      if (
        args[2] === "NEXT_PUBLIC_STRIPE_PUB_KEY" &&
        !args.includes("--type")
      ) {
        return {
          status: 1,
          stderr: "Provider rejected unapproved public credential",
        };
      }
      return { status: 0 };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const directory of directories.splice(0))
      rmSync(directory, { force: true, recursive: true });
  });

  it.each([
    ["development", "pk_test_PublicFixture123"],
    ["production", "pk_live_PublicFixture123"],
  ])(
    "syncs %s with explicit public-key consent and private stdin",
    async (environment, publicValue) => {
      const cwd = fixture(environment, publicValue);
      await expect(
        syncCommand({ cwd, env: environment, target: "vercel" }),
      ).resolves.toBe(true);
      const calls = run.mock.calls.filter(([, args]) => args[0] === "env");
      expect(calls).toHaveLength(5);
      for (const [command, args, options] of calls) {
        expect(command).toBe("vercel");
        expect(args.slice(0, 2)).toEqual(["env", "add"]);
        expect(args.slice(3, 6)).toEqual([
          "--environment",
          "production",
          "--force",
        ]);
        expect(options).toMatchObject({
          cwd,
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
        });
        expect(options.input).toBeTruthy();
        expect(args).not.toContain(options.input);
        if (args[2] === "NEXT_PUBLIC_STRIPE_PUB_KEY") {
          expect(args.slice(6)).toEqual(["--type", "config"]);
          expect(options.input).toBe(publicValue);
        } else {
          expect(args).not.toContain("--type");
        }
      }
      expect(
        JSON.parse(readFileSync(join(cwd, ".vercel/project.json"), "utf8")),
      ).toEqual({
        projectId: `project_${environment}`,
        orgId: "org_fixture",
      });
      const output = [
        ...vi.mocked(console.log).mock.calls,
        ...vi.mocked(console.error).mock.calls,
      ]
        .flat()
        .join("\n");
      for (const value of [publicValue, ...Object.values(privateValues)])
        expect(output).not.toContain(value);
    },
  );

  it.each([
    "sk_live_PrivateFixture",
    "rk_test_PrivateFixture",
    "whsec_PrivateFixture",
    "pk_live_",
    "pk_test_NotValid!",
  ])(
    "does not opt a private or malformed value into public config: %s",
    async (publicValue) => {
      const cwd = fixture("production", publicValue);
      await expect(
        syncCommand({ cwd, env: "production", target: "vercel" }),
      ).resolves.toBe(false);
      const call = run.mock.calls.find(
        ([, args]) => args[2] === "NEXT_PUBLIC_STRIPE_PUB_KEY",
      );
      expect(call?.[1]).not.toContain("--type");
    },
  );

  it("keeps dry runs free of commands and project-link writes", async () => {
    const cwd = fixture("production", "pk_live_PublicFixture123");
    await expect(
      syncCommand({ cwd, env: "production", target: "vercel", dryRun: true }),
    ).resolves.toBe(true);
    expect(run).not.toHaveBeenCalled();
    expect(existsSync(join(cwd, ".vercel"))).toBe(false);
  });

  function fixture(environment: string, publicValue: string): string {
    const cwd = mkdtempSync(join(tmpdir(), "king-config-vercel-sync-"));
    directories.push(cwd);
    mkdirSync(join(cwd, "config"));
    const values = {
      VERCEL_PROJECT_ID: `project_${environment}`,
      VERCEL_ORG_ID: "org_fixture",
      NEXT_PUBLIC_STRIPE_PUB_KEY: publicValue,
      NEXT_PUBLIC_SITE_URL: "https://www.example.com",
      ...privateValues,
    };
    const keys = [
      "NEXT_PUBLIC_STRIPE_PUB_KEY",
      "NEXT_PUBLIC_SITE_URL",
      ...Object.keys(privateValues),
    ];
    const core = Object.fromEntries(
      Object.keys(values).map((key) => [key, { required: true }]),
    );
    writeFileSync(
      join(cwd, "config/schema.ts"),
      `export const schema = {
      environments: { ${environment}: { mode: "hosted", sync: true } },
      core: ${JSON.stringify(core)}, computed: () => ({}), envfiles: {},
      services: { vercel: { keys: ${JSON.stringify(keys)} } },
    };`,
    );
    writeFileSync(
      join(cwd, `config/${environment}.ts`),
      `export const values = ${JSON.stringify(values)};`,
    );
    return cwd;
  }
});
