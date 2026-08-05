import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  clearFrontendDraft,
  FRONTEND_DRAFT_MARKER,
  frontendDraftMarkerPath,
  isFrontendDraft,
} from "./project-mode.js";
import { smokeProjectDirectoryName } from "./test-create-kingstack.js";

describe("create-kingstack smoke-test paths", () => {
  test("puts the timestamp on the project directory name", () => {
    expect(
      smokeProjectDirectoryName(
        "queens-go",
        new Date("2026-08-04T21:54:27.327Z"),
      ),
    ).toBe("queens-go-2026-08-04-21-54-27-327");
  });
});

describe("project mode", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "kingstack-project-mode-"));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  test("uses the frontend-draft marker as the project mode source", () => {
    expect(FRONTEND_DRAFT_MARKER).toBe(join(".kingstack", "frontend-draft"));
    expect(isFrontendDraft(projectRoot)).toBe(false);
    expect(clearFrontendDraft(projectRoot)).toBe(false);

    const markerPath = frontendDraftMarkerPath(projectRoot);
    expect(markerPath).toBe(join(projectRoot, FRONTEND_DRAFT_MARKER));
    mkdirSync(dirname(markerPath), { recursive: true });
    writeFileSync(markerPath, "draft\n");

    expect(isFrontendDraft(projectRoot)).toBe(true);
    expect(clearFrontendDraft(projectRoot)).toBe(true);
    expect(isFrontendDraft(projectRoot)).toBe(false);
  });
});
