# @kingstack/create-kingstack

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
