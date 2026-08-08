import { describe, expect, it } from "bun:test";
import {
  authConfigMatches,
  desiredHostedAuthConfig,
  normalizeHostedSiteUrl,
  parseHostedAuthConfig,
  resolveHostedAuthPlan,
  updateHostedAuthConfig,
  validateProjectRef,
  type AuthConfigFetcher,
  type HostedAuthPlan,
} from "./auth-config.js";
import { parseAuthConfigCliArgs } from "./auth-options.js";

const PROJECT_REF = "abcdefghijklmnopqrst";

describe("hosted Supabase Auth options", () => {
  it("defaults to immediate signup", () => {
    expect(parseAuthConfigCliArgs(["production"])).toEqual({
      environment: "production",
      requireEmailConfirmation: false,
      dryRun: false,
      yes: false,
      help: false,
    });
  });

  it("supports requiring email confirmation explicitly", () => {
    expect(
      parseAuthConfigCliArgs([
        "production",
        "--require-email-confirmation",
        "--dry-run",
      ]),
    ).toMatchObject({
      environment: "production",
      requireEmailConfirmation: true,
      dryRun: true,
    });
  });

  it("rejects unknown options", () => {
    expect(() => parseAuthConfigCliArgs(["--confirm"])).toThrow(
      "Unknown option",
    );
  });
});

describe("hosted Supabase Auth plan", () => {
  it("accepts an explicit hosted project and Site URL", async () => {
    const resolved = await resolveHostedAuthPlan({
      projectRef: PROJECT_REF,
      siteUrl: "https://kingstack.vercel.app/",
      requireEmailConfirmation: false,
      dryRun: false,
      yes: true,
      help: false,
    });
    expect(resolved).toEqual({
      projectRef: PROJECT_REF,
      siteUrl: "https://kingstack.vercel.app",
      requireEmailConfirmation: false,
    });
  });

  it("requires HTTPS for hosted redirects", () => {
    expect(() => normalizeHostedSiteUrl("http://localhost:3000")).toThrow(
      "requires an HTTPS Site URL",
    );
  });

  it("validates project references", () => {
    expect(validateProjectRef(PROJECT_REF)).toBe(PROJECT_REF);
    expect(() => validateProjectRef("short")).toThrow(
      "Invalid Supabase project reference",
    );
  });
});

describe("hosted Supabase Auth Management API", () => {
  const plan: HostedAuthPlan = {
    environment: "production",
    projectRef: PROJECT_REF,
    siteUrl: "https://kingstack.vercel.app",
    requireEmailConfirmation: false,
  };

  it("maps mailer_autoconfirm to the user-facing confirmation policy", () => {
    expect(
      parseHostedAuthConfig({
        site_url: "https://kingstack.vercel.app",
        mailer_autoconfirm: true,
      }),
    ).toEqual({
      siteUrl: "https://kingstack.vercel.app",
      emailConfirmationRequired: false,
    });
    expect(desiredHostedAuthConfig(plan)).toEqual({
      siteUrl: "https://kingstack.vercel.app",
      emailConfirmationRequired: false,
    });
  });

  it("compares URLs without a trailing-slash false positive", () => {
    expect(
      authConfigMatches(
        {
          siteUrl: "https://kingstack.vercel.app/",
          emailConfirmationRequired: false,
        },
        desiredHostedAuthConfig(plan),
      ),
    ).toBe(true);
  });

  it("patches only the Site URL and confirmation mode, then verifies", async () => {
    const requests: Array<{ method: string; body?: string }> = [];
    const fetcher: AuthConfigFetcher = (
      _input: string | URL | Request,
      init?: RequestInit,
    ) => {
      requests.push({
        method: init?.method || "GET",
        body: typeof init?.body === "string" ? init.body : undefined,
      });
      return Promise.resolve(
        new Response(
          JSON.stringify({
            site_url: plan.siteUrl,
            mailer_autoconfirm: true,
          }),
          { status: 200 },
        ),
      );
    };

    const updated = await updateHostedAuthConfig(
      plan,
      "secret-access-token",
      fetcher,
    );
    expect(updated).toEqual({
      siteUrl: plan.siteUrl,
      emailConfirmationRequired: false,
    });
    expect(requests).toHaveLength(2);
    expect(requests[0]).toEqual({
      method: "PATCH",
      body: JSON.stringify({
        site_url: plan.siteUrl,
        mailer_autoconfirm: true,
      }),
    });
    expect(requests[1]).toEqual({ method: "GET" });
  });

  it("fails when verification does not match the requested policy", async () => {
    let request = 0;
    const fetcher: AuthConfigFetcher = () => {
      request += 1;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            site_url: plan.siteUrl,
            mailer_autoconfirm: request === 1,
          }),
          { status: 200 },
        ),
      );
    };

    let message = "";
    try {
      await updateHostedAuthConfig(plan, "secret-access-token", fetcher);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("verification response does not match");
  });
});
