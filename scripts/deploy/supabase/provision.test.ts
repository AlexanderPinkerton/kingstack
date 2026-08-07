import { describe, expect, it } from "bun:test";
import {
  buildCreateArgs,
  computeDescription,
  parseCliArgs,
  REGIONS,
} from "./options.js";
import { formatProvisioningPlan, parseOrganizations } from "./provision.js";

describe("Supabase project provisioning CLI", () => {
  it("parses interactive and repeatable provisioning options", () => {
    expect(parseCliArgs(["example-app", "--dry-run"])).toMatchObject({
      projectName: "example-app",
      dryRun: true,
    });
    expect(
      parseCliArgs([
        "--name",
        "example-app",
        "--org-id",
        "example-org",
        "--region",
        "us-east-1",
        "--size",
        "small",
        "--yes",
      ]),
    ).toEqual({
      projectName: "example-app",
      orgId: "example-org",
      region: "us-east-1",
      size: "small",
      dryRun: false,
      yes: true,
      help: false,
    });
  });

  it("rejects ambiguous and unsupported inputs", () => {
    expect(() => parseCliArgs(["one", "two"])).toThrow("Unexpected argument");
    expect(() => parseCliArgs(["one", "--name", "two"])).toThrow(
      "positionally or with --name",
    );
    expect(() => parseCliArgs(["--region", "local"])).toThrow(
      "Unsupported region",
    );
    expect(() => parseCliArgs(["--size", "enormous"])).toThrow(
      "Unsupported compute size",
    );
    expect(() => parseCliArgs(["--org-id"])).toThrow("Missing value");
  });

  it("offers the regions supported by the pinned Supabase CLI", () => {
    const regionIds = REGIONS.map(({ id }) => id);

    expect(regionIds).toContain("us-east-1");
    expect(regionIds).toContain("us-east-2");
    expect(regionIds).toContain("eu-central-2");
    expect(regionIds).toContain("ap-east-1");
    expect(parseCliArgs(["--region", "us-east-2"]).region).toBe("us-east-2");
  });

  it("builds a secret-free Supabase CLI command", () => {
    const args = buildCreateArgs({
      projectName: "example-app",
      orgId: "example-org",
      region: "us-east-1",
      size: "small",
    });
    expect(args).toEqual([
      "exec",
      "supabase",
      "projects",
      "create",
      "example-app",
      "--org-id",
      "example-org",
      "--region",
      "us-east-1",
      "--size",
      "small",
      "--output",
      "json",
    ]);
    expect(args.join(" ")).not.toContain("password");
  });

  it("explains automatic and explicit compute pricing", () => {
    expect(computeDescription()).toContain("Automatic");
    expect(computeDescription("medium")).toContain("~$60/month");

    const plan = formatProvisioningPlan({
      projectName: "example-app",
      orgId: "example-org",
      region: "us-east-1",
      size: "micro",
    });
    expect(plan).toContain("Pro starts at $25/month");
    expect(plan).toContain("Compute is not protected by the Pro spend cap");
    expect(plan).toContain("https://supabase.com/pricing");
  });

  it("parses organization choices defensively", () => {
    expect(
      parseOrganizations(
        JSON.stringify([
          { id: "org-one", name: "One" },
          { id: "org-two", name: "Two", irrelevant: true },
        ]),
      ),
    ).toEqual([
      { id: "org-one", name: "One" },
      { id: "org-two", name: "Two" },
    ]);
    expect(() => parseOrganizations("{}")).toThrow("unexpected");
    expect(() => parseOrganizations("not-json")).toThrow("invalid");
  });
});
