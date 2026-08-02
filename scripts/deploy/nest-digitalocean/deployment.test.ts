import { describe, expect, it } from "bun:test";
import { buildFirewallRules, selectDeploymentTargets } from "./digitalocean.js";
import {
  renderBootstrapScript,
  renderCaddyApplyScript,
  renderCaddyFragment,
  renderCaddyInstallScript,
  renderCloudInit,
  renderRemoteDeployScript,
} from "./host-scripts.js";
import {
  getDefaultTag,
  parseCliArgs,
  parsePort,
  resolveDomain,
  sanitizeSlug,
  validateRequiredOptions,
} from "./options.js";
import {
  renderEnvFile,
  renderNestDeploymentEnv,
  validateHostedNestConfig,
} from "./project-config.js";

describe("DigitalOcean Nest deployment CLI", () => {
  it("parses provision and deploy options", () => {
    expect(
      parseCliArgs([
        "provision",
        "production",
        "--region",
        "nyc3",
        "--ssh-source",
        "192.0.2.4/32",
        "--backups",
        "--deploy",
        "--skip-migrations",
        "--without-database",
      ]),
    ).toMatchObject({
      command: "provision",
      environment: "production",
      region: "nyc3",
      sshSources: ["192.0.2.4/32"],
      backups: true,
      deployAfterProvision: true,
      skipMigrations: true,
      withoutDatabase: true,
      size: "s-1vcpu-1gb",
    });

    expect(
      parseCliArgs([
        "deploy",
        "development",
        "--droplet",
        "api-1",
        "--droplet",
        "42",
        "--env-only",
        "--yes",
      ]),
    ).toMatchObject({
      command: "deploy",
      environment: "development",
      droplets: ["api-1", "42"],
      envOnly: true,
      yes: true,
    });
  });

  it("rejects ambiguous or incomplete commands", () => {
    expect(() =>
      parseCliArgs([
        "deploy",
        "production",
        "--domain",
        "api.example.com",
        "--no-domain",
      ]),
    ).toThrow("either --domain or --no-domain");
    expect(() =>
      parseCliArgs([
        "deploy",
        "production",
        "--tag",
        "api",
        "--droplet",
        "api-1",
      ]),
    ).toThrow("either --tag or --droplet");
    expect(() =>
      validateRequiredOptions(parseCliArgs(["provision", "production"])),
    ).toThrow("requires --region");
    expect(() =>
      parseCliArgs(["provision", "production", "--skip-migrations"]),
    ).toThrow("requires --deploy");
    expect(() => parseCliArgs(["deploy", "production", "--deploy"])).toThrow(
      "only valid with the provision command",
    );
    expect(() =>
      parseCliArgs(["deploy", "production", "--env-only", "--skip-migrations"]),
    ).toThrow("already skips migrations");
    expect(() =>
      parseCliArgs(["provision", "production", "--without-database"]),
    ).toThrow("requires --deploy");
  });

  it("derives stable project and tag names", () => {
    expect(sanitizeSlug("@example/My_App")).toBe("my-app");
    expect(getDefaultTag("my-app", "production")).toBe(
      "my-app-production-nest",
    );
    const longTag = getDefaultTag("a".repeat(60), "production");
    expect(longTag).toHaveLength(63);
    expect(longTag).toEndWith("-production-nest");
    expect(() => sanitizeSlug("___")).toThrow("Cannot derive");
  });

  it("derives Caddy mode from config with explicit overrides", () => {
    expect(resolveDomain("https://api.example.com")).toBe("api.example.com");
    expect(resolveDomain("http://localhost:3000")).toBeUndefined();
    expect(
      resolveDomain("https://api.example.com", undefined, true),
    ).toBeUndefined();
    expect(resolveDomain("http://localhost:3000", "edge.example.com")).toBe(
      "edge.example.com",
    );
    expect(() => resolveDomain("https://-bad.example.com")).toThrow(
      "Invalid domain",
    );
  });

  it("renders only the requested Nest environment keys", () => {
    const env = renderEnvFile(
      { SECRET: "value#with spaces", NEST_PORT: "3099", UNUSED: "hidden" },
      { keys: ["SECRET"], aliases: { NEST_PORT: "PORT" } },
    );
    expect(env).toBe("SECRET=value#with spaces\nPORT=3099\n");
    expect(env).not.toContain("UNUSED");
    expect(() =>
      renderEnvFile({ SECRET: "line-one\nline-two" }, { keys: ["SECRET"] }),
    ).toThrow("cannot contain a newline");
  });

  it("rejects local-only pretty logging before a hosted deployment", () => {
    expect(() =>
      validateHostedNestConfig({ LOG_FORMAT: "pretty" }, "development"),
    ).toThrow('Hosted Nest deployments require LOG_FORMAT="json"');
    expect(() =>
      validateHostedNestConfig({ LOG_FORMAT: "json" }, "development"),
    ).not.toThrow();
  });

  it("can disable the eager Prisma connection in the deployed environment", () => {
    expect(renderNestDeploymentEnv("PORT=3075\n", false)).toBe("PORT=3075\n");
    expect(renderNestDeploymentEnv("PORT=3075\n", true)).toBe(
      "PORT=3075\nPRISMA_CONNECT_ON_START=false\n",
    );
  });

  it("selects active tagged droplets or exact requested droplets", () => {
    const droplets = [
      {
        id: 2,
        name: "api-b",
        status: "active",
        tags: ["my-app-production-nest"],
        networks: { v4: [{ type: "public", ip_address: "192.0.2.2" }] },
      },
      {
        id: 1,
        name: "api-a",
        status: "active",
        tags: ["my-app-production-nest"],
        networks: { v4: [{ type: "public", ip_address: "192.0.2.1" }] },
      },
    ];

    expect(
      selectDeploymentTargets(droplets, "my-app-production-nest", []),
    ).toEqual([
      { id: 1, name: "api-a", ip: "192.0.2.1" },
      { id: 2, name: "api-b", ip: "192.0.2.2" },
    ]);
    expect(selectDeploymentTargets(droplets, "unused", ["2"])).toEqual([
      { id: 2, name: "api-b", ip: "192.0.2.2" },
    ]);
    expect(() =>
      selectDeploymentTargets(droplets, "unused", ["missing"]),
    ).toThrow("Droplet(s) not found");
  });

  it("builds domain and raw-port firewall policies", () => {
    const caddyRules = buildFirewallRules(3099, "api.example.com", [
      "192.0.2.4/32",
    ]);
    expect(caddyRules.inbound).toContain(
      "protocol:tcp,ports:22,address:192.0.2.4/32",
    );
    expect(caddyRules.inbound).toContain("protocol:tcp,ports:443");
    expect(caddyRules.inbound).not.toContain("ports:3099");

    const rawRules = buildFirewallRules(3099, undefined, []);
    expect(rawRules.inbound).toContain("protocol:tcp,ports:3099");
    expect(rawRules.inbound).not.toContain("ports:443");
    expect(() => buildFirewallRules(3099, undefined, ["not-a-cidr"])).toThrow(
      "Invalid SSH source CIDR",
    );
  });

  it("renders reproducible host bootstrap configuration", () => {
    const bootstrap = renderBootstrapScript("my-app");
    expect(bootstrap).toContain("download.docker.com/linux/ubuntu");
    expect(bootstrap).toContain("caddy-stable.list");
    expect(bootstrap).toContain("/opt/kingstack/my-app");
    expect(bootstrap).not.toContain("get.docker.com | sh");

    const cloudInit = renderCloudInit("my-app");
    expect(cloudInit).toContain("ssh_pwauth: false");
    expect(cloudInit).toContain("kingstack-bootstrap");

    const caddyInstall = renderCaddyInstallScript();
    expect(caddyInstall).toContain("apt-get install -y caddy");
    expect(caddyInstall).not.toContain("docker-ce");
  });

  it("renders candidate validation and scoped rollback without global pruning", () => {
    const script = renderRemoteDeployScript({
      appSlug: "my-app",
      imageReference: "my-app-nest:image-abc123",
      revision: "image-abc123",
      port: parsePort("3099"),
      domain: "api.example.com",
    });
    expect(script).toContain("my-app-nest-candidate");
    expect(script).toContain("wait_ready");
    expect(script).toContain("restore_previous");
    expect(script).toContain("127.0.0.1:3099:3099");
    expect(script).toContain('docker image rm "$old_previous_image"');
    expect(script).not.toContain("docker system prune");
  });

  it("renders isolated, validated Caddy configuration", () => {
    expect(renderCaddyFragment("api.example.com", 3099)).toContain(
      "reverse_proxy 127.0.0.1:3099",
    );
    const script = renderCaddyApplyScript(
      "my-app",
      renderCaddyFragment("api.example.com", 3099),
    );
    expect(script).toContain("/etc/caddy/conf.d/my-app.caddy");
    expect(script).toContain("caddy validate");
    expect(script).toContain("caddy reload");
    expect(script).toContain("--adapter caddyfile");
    expect(script).not.toContain("api.example.com");
  });
});
