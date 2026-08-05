import { describe, expect, it } from "vitest";
import { parseArgs, promptForConfig } from "../cli";
import { getSetupProfile } from "../setup";

describe("setup selection", () => {
  it("parses an explicit draft setup", () => {
    expect(parseArgs(["my-app", "--draft"])).toMatchObject({
      projectName: "my-app",
      setup: "draft",
    });
  });

  it("parses an explicit full-stack setup", () => {
    expect(parseArgs(["my-app", "--full"])).toMatchObject({
      projectName: "my-app",
      setup: "full",
    });
  });

  it("rejects conflicting setup flags", () => {
    expect(() => parseArgs(["my-app", "--draft", "--full"])).toThrow(
      "cannot be used together",
    );
  });

  it("parses local-template smoke-test controls", () => {
    expect(
      parseArgs([
        "my-app",
        "--draft",
        "--template-dir",
        "../kingstack",
        "--no-start",
        "--yes",
      ]),
    ).toMatchObject({
      projectName: "my-app",
      setup: "draft",
      noStart: true,
      yes: true,
    });
  });

  it("keeps the project name separate from an explicit target directory", async () => {
    const args = parseArgs([
      "my-app",
      "--draft",
      "--yes",
      "--target-dir",
      "/tmp/my-app-smoke-run",
    ]);

    await expect(promptForConfig(args)).resolves.toMatchObject({
      projectName: "my-app",
      targetDir: "/tmp/my-app-smoke-run",
    });
  });

  it("parses an explicit project port block", () => {
    expect(parseArgs(["my-app", "--port-base", "17420"])).toMatchObject({
      projectName: "my-app",
      portBase: 17420,
    });
  });

  it("rejects invalid project port blocks", () => {
    expect(() => parseArgs(["my-app", "--port-base", "70000"])).toThrow(
      "--port-base requires an integer",
    );
  });

  it("keeps draft setup independent from Docker and backend startup", () => {
    expect(getSetupProfile("draft")).toMatchObject({
      requiresDocker: false,
      totalSteps: 10,
      devScript: "dev:frontend",
    });
  });

  it("retains complete infrastructure setup for full-stack projects", () => {
    expect(getSetupProfile("full")).toMatchObject({
      requiresDocker: true,
      totalSteps: 12,
      devScript: "dev",
    });
  });
});
