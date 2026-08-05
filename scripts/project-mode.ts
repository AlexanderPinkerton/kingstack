import { existsSync, rmSync } from "fs";
import { join, resolve } from "path";

export const FRONTEND_DRAFT_MARKER = join(".kingstack", "frontend-draft");

export function frontendDraftMarkerPath(projectRoot = process.cwd()): string {
  return join(resolve(projectRoot), FRONTEND_DRAFT_MARKER);
}

export function isFrontendDraft(projectRoot = process.cwd()): boolean {
  return existsSync(frontendDraftMarkerPath(projectRoot));
}

export function clearFrontendDraft(projectRoot = process.cwd()): boolean {
  const markerPath = frontendDraftMarkerPath(projectRoot);
  if (!existsSync(markerPath)) return false;

  rmSync(markerPath);
  return true;
}
