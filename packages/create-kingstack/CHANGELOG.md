# @kingstack/create-kingstack

## 0.5.1

### Patch Changes

- e0de7c6: Preserve existing TOML formatting while updating mapped configuration values,
  and ensure KingStack development commands execute the current configuration
  source instead of stale build output.

## 0.5.0

### Minor Changes

- c263789: Add existing-project port status, listing, registration, reassignment, and release commands. Reassignment moves legacy configurations to a safe contiguous block while preserving non-port local values and regenerating derived environment files.

### Patch Changes

- c5c128e: Add first-class environment metadata and modes, standalone schema initialization, context-aware validation, strict stale-key and output-mapping checks, redacted configuration coverage and drift commands, and environment listing/scaffolding. Update generated KingStack projects to use the new environment-aware config package.

## 0.4.0

### Minor Changes

- 42ac1fe: Add the published structured logger package and project it into generated Next.js and NestJS applications with runtime configuration, redaction, request correlation, and browser-safe adapters.

## 0.3.0

### Minor Changes

- 7ce3d67: Add frontend-draft and full-stack setup choices so generated projects can start
  without Docker or Supabase while retaining the complete stack for later. Add
  local-working-tree and no-start controls plus a root clean-room verification
  helper for pre-release smoke testing. Automatically allocate and reserve a
  complete local-service port block for each generated project, and add a guided
  `yarn backend:enable` command for promoting drafts to the complete local stack.
  Keep the unused Supabase Edge Runtime disabled until a project adds Edge
  Functions, avoiding an unnecessary startup dependency. Generate applications
  from an explicit template allowlist, give them application-specific
  documentation, and consume the published comment-tree and dnd-tree primitives
  from npm instead of copying their source. Standardize the repository and all
  published packages on the MIT license.

## Unreleased

### Minor Changes

- Add frontend-draft and full-stack setup choices. Draft setup generates the
  complete project but does not require Docker or start Supabase, initialize
  the shadow database, or run migrations.
- Add safe local-working-tree and no-start controls for testing the compiled
  CLI against uncommitted template changes.
- Add a root smoke-test helper that scaffolds into
  `~/kingstack-smoke-tests`, delegates setup selection to the real CLI prompt,
  then typechecks and tests the generated project.
- Automatically find and reserve a complete project port block, including the
  Supabase Edge Runtime inspector, while retaining `--port-base` as an override.
- Add a guided `yarn backend:enable` command to promote generated draft
  projects to the complete local Supabase, Prisma, and NestJS workflow.
- Leave Supabase's optional Edge Runtime disabled until a generated project
  adds Edge Functions.
- Generate projects from an explicit allowlist so new upstream packages and
  maintainer tooling cannot leak into application templates.
- Install `@kingstack/comment-tree` and `@kingstack/dnd-tree` from npm rather
  than copying their implementation source.
- Install a dedicated application README in generated projects instead of
  reusing the upstream ecosystem README.
- Include the repository-wide MIT license in generated applications.

## 0.2.3

### Patch Changes

- 988cf0b: Install `@kingstack/advanced-optimistic-store` from npm in generated projects
  instead of copying its workspace source.

## 0.2.2

### Patch Changes

- b7e78ec: better detection of utils

## 0.2.1

### Patch Changes

- ccf4439: Stability

## 0.2.0

### Minor Changes

- eaba09b: New package to help users setup projects
