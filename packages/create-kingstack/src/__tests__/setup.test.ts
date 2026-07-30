import { describe, expect, it } from "vitest";
import { parseArgs } from "../cli";
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
