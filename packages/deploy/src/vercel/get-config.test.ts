import { describe, expect, it } from "bun:test";
import { updateEnvironmentValues } from "@kingstack/config";
import {
  parseProjectDomains,
  parseProjectLink,
  isSupportedVercelCliVersion,
  productionDomains,
  selectRequestedDomain,
  type VercelConfigValues,
} from "./get-config.js";
import {
  normalizeHostname,
  parseGetVercelConfigCliArgs,
} from "./get-config-options.js";

const importedValues: VercelConfigValues = {
  NEXT_HOST: "app.example.com",
  VERCEL_ORG_ID: "team_example",
  VERCEL_PROJECT_ID: "prj_example",
};

describe("Vercel configuration import CLI", () => {
  it("accepts only the declared Vercel CLI range", () => {
    expect(isSupportedVercelCliVersion("Vercel CLI 58.1.0")).toBe(true);
    expect(isSupportedVercelCliVersion("58.9.2")).toBe(true);
    expect(isSupportedVercelCliVersion("58.0.9")).toBe(false);
    expect(isSupportedVercelCliVersion("59.0.0")).toBe(false);
  });
  it("parses file, host, and print destinations", () => {
    expect(
      parseGetVercelConfigCliArgs([
        "production",
        "--host",
        "https://App.Example.com",
        "--yes",
      ]),
    ).toEqual({
      environment: "production",
      host: "app.example.com",
      print: false,
      yes: true,
      help: false,
    });
    expect(parseGetVercelConfigCliArgs(["--print"])).toEqual({
      print: true,
      yes: false,
      help: false,
    });
    expect(() =>
      parseGetVercelConfigCliArgs(["production", "--print"]),
    ).toThrow("separate destinations");
  });

  it("accepts hostnames but rejects ports and paths", () => {
    expect(normalizeHostname("KingStack.vercel.app")).toBe(
      "kingstack.vercel.app",
    );
    expect(() => normalizeHostname("app.example.com:3000")).toThrow(
      "provide only a hostname",
    );
    expect(() => normalizeHostname("https://app.example.com/path")).toThrow(
      "provide only a hostname",
    );
  });

  it("parses the Vercel link file", () => {
    expect(
      parseProjectLink(
        JSON.stringify({
          projectId: "prj_example",
          orgId: "team_example",
          projectName: "kingstack-production",
        }),
      ),
    ).toEqual({
      projectId: "prj_example",
      orgId: "team_example",
      projectName: "kingstack-production",
    });
    expect(() => parseProjectLink('{"projectId":"prj_example"}')).toThrow(
      "projectId and orgId",
    );
  });

  it("keeps verified production domains and prefers a canonical custom host", () => {
    const domains = productionDomains(
      parseProjectDomains(
        JSON.stringify({
          domains: [
            {
              name: "kingstack.vercel.app",
              verified: true,
              redirect: null,
              gitBranch: null,
              customEnvironmentId: null,
            },
            {
              name: "www.example.com",
              verified: true,
              redirect: null,
              gitBranch: null,
              customEnvironmentId: null,
            },
            {
              name: "example.com",
              verified: true,
              redirect: "www.example.com",
              gitBranch: null,
              customEnvironmentId: null,
            },
            {
              name: "preview.example.com",
              verified: true,
              redirect: null,
              gitBranch: "feature",
              customEnvironmentId: null,
            },
            {
              name: "unverified.example.com",
              verified: false,
              redirect: null,
              gitBranch: null,
              customEnvironmentId: null,
            },
          ],
        }),
      ),
    );

    expect(domains.map(({ name }) => name)).toEqual([
      "www.example.com",
      "kingstack.vercel.app",
      "example.com",
    ]);
    expect(selectRequestedDomain(domains, "kingstack.vercel.app").name).toBe(
      "kingstack.vercel.app",
    );
    expect(() => selectRequestedDomain(domains, "preview.example.com")).toThrow(
      "not a verified production domain",
    );
  });

  it("updates only Vercel-owned values and preserves Supabase credentials", () => {
    const current = `import { defineValues } from "@kingstack/config";
import type { ConfigValues } from "./schema.js";

export const values = defineValues({
  NEXT_HOST: "old.example.com",
  SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
  SUPABASE_SECRET_KEY: "keep-this-secret",
  VERCEL_PROJECT_ID: "old-project",
} satisfies ConfigValues);
`;
    const updated = updateEnvironmentValues(current, importedValues);

    expect(updated).toContain('NEXT_HOST: "app.example.com"');
    expect(updated).toContain('VERCEL_ORG_ID: "team_example"');
    expect(updated).toContain('VERCEL_PROJECT_ID: "prj_example"');
    expect(updated).toContain('SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst"');
    expect(updated).toContain('SUPABASE_SECRET_KEY: "keep-this-secret"');
    expect(updated).not.toContain("old.example.com");
    expect(updated).not.toContain("old-project");
  });
});
