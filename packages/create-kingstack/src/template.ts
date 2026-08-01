// ============================================================================
// Template operations for create-kingstack CLI
// ============================================================================

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
  statSync,
} from "fs";
import { spawnSync } from "child_process";
import { dirname, isAbsolute, join, relative, resolve } from "path";
import {
  SKIP_PATTERNS,
  PROCESS_EXTENSIONS,
  PUBLISHED_PACKAGES,
  PACKAGES_TO_REMOVE,
  REPO_GIT_URL,
  TEMPLATE_PATHS,
} from "./constants";
import { commandExists, error, runCommandWithRetry } from "./utils";

// ============================================================================
// Template Cloning
// ============================================================================

/**
 * Clone the KingStack template to the target directory
 * Uses shallow git clone for speed (no history, main branch only)
 */
export function cloneTemplate(
  targetDir: string,
  options: { templateDir?: string } = {},
): boolean {
  if (options.templateDir) {
    return copyLocalTemplate(options.templateDir, targetDir);
  }

  if (!commandExists("git")) {
    error("git is not installed. Please install git and try again.");
    return false;
  }

  // Clean up any existing directory
  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true });
  }

  // Shallow clone main branch only
  const success = runCommandWithRetry(
    `git clone --depth 1 --branch main ${REPO_GIT_URL} "${targetDir}"`,
    process.cwd(),
    { retries: 2 },
  );

  if (success) {
    // Remove .git folder - user will init their own repo
    rmSync(join(targetDir, ".git"), { recursive: true, force: true });
    return projectTemplateDirectory(targetDir);
  }

  error("git clone failed after retries");
  return false;
}

/**
 * Copy the current state of a local Git working tree, including uncommitted
 * tracked changes and non-ignored untracked files.
 */
export function copyLocalTemplate(
  sourceDir: string,
  targetDir: string,
): boolean {
  const source = resolve(sourceDir);
  const target = resolve(targetDir);
  const targetFromSource = relative(source, target);

  if (
    target === source ||
    (!targetFromSource.startsWith("..") && !isAbsolute(targetFromSource))
  ) {
    error("Local template output must be outside the source repository.");
    return false;
  }

  const filesResult = spawnSync(
    "git",
    [
      "-C",
      source,
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
    ],
    {
      encoding: "buffer",
      maxBuffer: 50 * 1024 * 1024,
    },
  );

  if (filesResult.status !== 0 || !filesResult.stdout) {
    error(`${source} is not a readable Git working tree.`);
    return false;
  }

  const files = filesResult.stdout
    .toString("utf8")
    .split("\0")
    .filter((file) => file && isTemplateFile(file));

  if (files.length === 0) {
    error(`No template files were found in ${source}.`);
    return false;
  }

  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }
  mkdirSync(target, { recursive: true });

  for (const file of files) {
    const sourcePath = join(source, file);
    if (!existsSync(sourcePath)) continue;

    const targetPath = join(target, file);
    mkdirSync(dirname(targetPath), { recursive: true });
    cpSync(sourcePath, targetPath, {
      recursive: true,
      preserveTimestamps: true,
    });
  }

  return projectTemplateDirectory(target);
}

function normalizeTemplatePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

export function isTemplateFile(path: string): boolean {
  const normalized = normalizeTemplatePath(path);

  return TEMPLATE_PATHS.some(
    (templatePath) =>
      normalized === templatePath || normalized.startsWith(`${templatePath}/`),
  );
}

function pruneNonTemplateFiles(directory: string, root: string): void {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      pruneNonTemplateFiles(path, root);
      if (readdirSync(path).length === 0) {
        rmSync(path, { recursive: true, force: true });
      }
      continue;
    }

    const relativePath = normalizeTemplatePath(relative(root, path));
    if (!isTemplateFile(relativePath)) {
      rmSync(path, { force: true });
    }
  }
}

/**
 * Reduce a KingStack source checkout to the deliberately supported generated
 * project surface. Unknown future repository files are excluded by default.
 */
export function projectTemplateDirectory(targetDir: string): boolean {
  const target = resolve(targetDir);
  pruneNonTemplateFiles(target, target);

  const generatedReadme = join(target, "template", "readme.md");
  if (!existsSync(generatedReadme)) {
    error("The generated-project README is missing from the template source.");
    return false;
  }

  cpSync(generatedReadme, join(target, "readme.md"));
  rmSync(join(target, "template"), { recursive: true, force: true });
  return true;
}

// ============================================================================
// File Traversal
// ============================================================================

/**
 * Get all files in a directory that should be processed for namespace replacement
 */
export function getAllFiles(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    if (
      SKIP_PATTERNS.some(
        (pattern) => entry === pattern || entry.startsWith(pattern),
      )
    ) {
      continue;
    }

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (stat.isFile()) {
      const ext = entry.substring(entry.lastIndexOf("."));
      if (PROCESS_EXTENSIONS.includes(ext) || entry === "Dockerfile") {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Get all package.json files in a directory
 */
export function getAllPackageJsonFiles(
  dir: string,
  files: string[] = [],
): string[] {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    if (SKIP_PATTERNS.some((pattern) => entry === pattern)) {
      continue;
    }

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      getAllPackageJsonFiles(fullPath, files);
    } else if (entry === "package.json") {
      files.push(fullPath);
    }
  }

  return files;
}

// ============================================================================
// Namespace Replacement
// ============================================================================

/**
 * Replace @kingstack/* namespace with @projectName/* in all files
 * Preserves published packages (like @kingstack/config)
 */
export function replaceNamespace(
  targetDir: string,
  projectName: string,
): number {
  const files = getAllFiles(targetDir);
  let modifiedCount = 0;

  // Get list of published package names (without @kingstack/ prefix)
  const publishedNames = Object.keys(PUBLISHED_PACKAGES).map((p) =>
    p.replace("@kingstack/", ""),
  );

  // Build regex that matches @kingstack/ followed by anything except published package names
  // Uses negative lookahead to exclude published packages
  const privatePackagePattern = new RegExp(
    `@kingstack/(?!(?:${publishedNames.join("|")})(?:[/"'\\s\\]]))`,
    "g",
  );

  for (const filePath of files) {
    try {
      const content = readFileSync(filePath, "utf-8");
      const newContent = content.replace(
        privatePackagePattern,
        `@${projectName}/`,
      );

      if (content !== newContent) {
        writeFileSync(filePath, newContent, "utf-8");
        modifiedCount++;
      }
    } catch {
      // Skip files that can't be read/written
    }
  }

  return modifiedCount;
}

/**
 * Replace workspace:* versions with actual npm versions for published packages
 */
export function replaceWorkspaceVersions(targetDir: string): number {
  const packageJsonFiles = getAllPackageJsonFiles(targetDir);
  let modifiedCount = 0;

  for (const filePath of packageJsonFiles) {
    try {
      const content = readFileSync(filePath, "utf-8");
      const pkg = JSON.parse(content);
      let modified = false;

      // Check dependencies and devDependencies
      for (const depType of ["dependencies", "devDependencies"] as const) {
        if (pkg[depType]) {
          for (const [name, version] of Object.entries(pkg[depType])) {
            if (
              PUBLISHED_PACKAGES[name] &&
              (version === "workspace:*" || version === "workspace:^")
            ) {
              pkg[depType][name] = PUBLISHED_PACKAGES[name];
              modified = true;
            }
          }
        }
      }

      if (modified) {
        writeFileSync(filePath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
        modifiedCount++;
      }
    } catch {
      // Skip files that can't be processed
    }
  }

  return modifiedCount;
}

/**
 * Remove upstream-only source and release tooling from a projected template.
 * Published KingStack libraries are installed from npm in generated projects.
 */
export function prepareGeneratedProject(targetDir: string): number {
  let removedCount = 0;

  for (const packagePath of PACKAGES_TO_REMOVE) {
    const fullPath = join(targetDir, packagePath);
    if (existsSync(fullPath)) {
      rmSync(fullPath, { recursive: true, force: true });
      removedCount++;
    }
  }

  for (const maintainerPath of [
    ".changeset",
    ".github/workflows/release-changeset.yml",
    "scripts/get-public-packages.ts",
    "scripts/test-create-kingstack.ts",
    "setup-guide.md",
  ]) {
    rmSync(join(targetDir, maintainerPath), {
      recursive: true,
      force: true,
    });
  }

  const rootPackagePath = join(targetDir, "package.json");
  if (existsSync(rootPackagePath)) {
    try {
      const rootPackage = JSON.parse(readFileSync(rootPackagePath, "utf-8"));
      for (const script of [
        "build:release-packages",
        "test:create-kingstack",
      ]) {
        delete rootPackage.scripts?.[script];
      }
      delete rootPackage.devDependencies?.["@changesets/cli"];
      writeFileSync(
        rootPackagePath,
        JSON.stringify(rootPackage, null, 2) + "\n",
        "utf-8",
      );
    } catch {
      // Namespace replacement will report malformed package files later.
    }
  }

  // Dockerfiles commonly copy workspace manifests before dependency
  // installation. Remove COPY lines for packages that no longer exist in the
  // generated project.
  const dockerfiles = getAllFiles(targetDir).filter((filePath) =>
    filePath.endsWith("Dockerfile"),
  );

  for (const dockerfile of dockerfiles) {
    const content = readFileSync(dockerfile, "utf-8");
    const publishedPackageNames = Object.keys(PUBLISHED_PACKAGES);
    const nextContent = content
      .split("\n")
      .filter(
        (line) =>
          !PACKAGES_TO_REMOVE.some((packagePath) =>
            line.includes(`${packagePath}/`),
          ) &&
          !publishedPackageNames.some((packageName) =>
            line.includes(`workspace ${packageName} `),
          ),
      )
      .join("\n");

    if (nextContent !== content) {
      writeFileSync(dockerfile, nextContent, "utf-8");
    }
  }

  return removedCount;
}
