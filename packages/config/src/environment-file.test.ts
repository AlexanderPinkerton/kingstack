import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  updateEnvironmentValues,
  writeEnvironmentFile,
} from "./environment-file";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("environment value files", () => {
  it("updates selected values without replacing unrelated project config", () => {
    const current = `import { defineValues } from "@kingstack/config";

// Keep this project-specific value and comment.
export const values = defineValues({
  NEXT_HOST: "old.example.com",
  SUPABASE_PROJECT_REF: "keep-me",
});
`;

    const updated = updateEnvironmentValues(current, {
      NEXT_HOST: "new.example.com",
      VERCEL_PROJECT_ID: "project-123",
    });

    expect(updated).toContain(
      "// Keep this project-specific value and comment.",
    );
    expect(updated).toContain('NEXT_HOST: "new.example.com"');
    expect(updated).toContain('SUPABASE_PROJECT_REF: "keep-me"');
    expect(updated).toContain('VERCEL_PROJECT_ID: "project-123"');
  });

  it("refuses to write a credential-bearing file tracked by Git", () => {
    const root = createProject();

    expect(() =>
      writeEnvironmentFile(
        "production",
        { SUPABASE_SECRET_KEY: "secret" },
        "Hosted values.",
        { cwd: root },
      ),
    ).toThrow("is not ignored by Git");
  });

  it("writes an ignored environment file with owner-only permissions", () => {
    const root = createProject();
    writeFileSync(join(root, ".gitignore"), "config/production.ts\n");
    const path = join(root, "config/production.ts");
    writeFileSync(
      path,
      `import { defineValues } from "@kingstack/config";
export const values = defineValues({ SUPABASE_SECRET_KEY: "old" });
`,
      { mode: 0o644 },
    );

    const relativePath = writeEnvironmentFile(
      "production",
      { SUPABASE_SECRET_KEY: "secret" },
      "Hosted values.",
      { cwd: root },
    );

    expect(relativePath).toBe("config/production.ts");
    expect(readFileSync(path, "utf8")).toContain(
      'SUPABASE_SECRET_KEY: "secret"',
    );
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });
});

function createProject(): string {
  const root = mkdtempSync(join(tmpdir(), "kingstack-config-test-"));
  temporaryDirectories.push(root);
  mkdirSync(join(root, "config"));
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  return root;
}
