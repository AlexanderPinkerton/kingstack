# @kingstack/config

## 0.2.1

### Patch Changes

- e0de7c6: Preserve existing TOML formatting while updating mapped configuration values,
  and ensure KingStack development commands execute the current configuration
  source instead of stale build output.

## 0.2.0

### Minor Changes

- c5c128e: Add first-class environment metadata and modes, standalone schema initialization, context-aware validation, strict stale-key and output-mapping checks, redacted configuration coverage and drift commands, and environment listing/scaffolding. Update generated KingStack projects to use the new environment-aware config package.

## 0.1.5

### Patch Changes

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

## 0.1.4

### Patch Changes

- 9be7b6e: Added repository key

## 0.1.3

### Patch Changes

- 35630a8: add author

## 0.1.2

### Patch Changes

- 180d0e1: added mit license to package.json

## 0.1.1

### Patch Changes

- 7842714: Fix empty publish

## 0.1.0

### Minor Changes

- 7b04494: First publish of config system
