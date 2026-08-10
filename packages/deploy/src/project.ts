import { resolve } from "node:path";

export interface KingStackProject {
  root: string;
}

export function resolveKingStackProject(
  cwd: string | undefined,
  currentWorkingDirectory: string,
): KingStackProject {
  return {
    root: resolve(currentWorkingDirectory, cwd || "."),
  };
}
