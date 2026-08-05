import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  configureProjectSetup,
  FRONTEND_DRAFT_MARKER,
} from "../config-generators";

describe("generated project setup marker", () => {
  let testRoot: string;

  beforeEach(() => {
    testRoot = mkdtempSync(join(tmpdir(), "kingstack-project-setup-"));
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it("marks frontend drafts so CI can skip backend migrations", () => {
    configureProjectSetup(testRoot, "draft");

    expect(FRONTEND_DRAFT_MARKER).toBe(join(".kingstack", "frontend-draft"));
    const markerPath = join(testRoot, ".kingstack", "frontend-draft");
    expect(existsSync(markerPath)).toBe(true);
    expect(readFileSync(markerPath, "utf-8")).toContain(
      "skip backend database migrations",
    );
  });

  it("does not mark full-stack projects as drafts", () => {
    configureProjectSetup(testRoot, "draft");
    configureProjectSetup(testRoot, "full");

    expect(existsSync(join(testRoot, FRONTEND_DRAFT_MARKER))).toBe(false);
  });
});
