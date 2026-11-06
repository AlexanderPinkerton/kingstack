# @kingstack/deploy

## 0.2.2

### Patch Changes

- Updated dependencies [7539f2b]
  - @kingstack/config@0.5.0

## 0.2.1

### Patch Changes

- Updated dependencies [bdb06bf]
  - @kingstack/config@0.4.0

## 0.2.0

### Minor Changes

- a63304b: Resolve the Nest Dockerfile beside the schema's Nest envfile so projects with
  renamed backend workspaces can deploy. Support NEST_HEALTHCHECK_PATH (default /)
  and require a 2xx readiness response. Mark validation containers with
  KINGSTACK_DEPLOYMENT_CANDIDATE=true so applications can disable scheduled jobs
  until the active container starts.

  Update the supported Vercel CLI range to >=65.10.0 <66 and the template tooling pin to 65.10.0.

### Patch Changes

- 16306a1: Reject redirect aliases when importing NEXT_HOST from Vercel, and offer only destination domains for automatic or interactive selection. This keeps frontend metadata, backend CORS, and Auth redirects on the same canonical origin.

  Nest deployment also checks the configured frontend with a read-only, bounded HTTP request and warns when it redirects to another origin. Unavailable frontends remain advisory so first deployments can proceed.

- Updated dependencies [67cf297]
  - @kingstack/config@0.3.1

## 0.1.1

### Patch Changes

- 435dd0e: Declare the `@kingstack/config` runtime dependency with a registry-resolvable version instead of the monorepo-only `workspace:*` protocol.

## 0.1.0

### Minor Changes

- f52f10d: Extract the hosted DigitalOcean, Supabase, and Vercel deployment commands into
  the versioned `@kingstack/deploy` package. Generated projects now pin the
  deployment CLI instead of receiving copied deployment source, while
  `@kingstack/config` exposes the supported project-loading and safe environment
  update APIs used by the package. Generated projects also lint that every Yarn
  workspace manifest is copied into the Nest Dockerfile.

### Patch Changes

- Updated dependencies [f52f10d]
  - @kingstack/config@0.3.0

No public releases yet. Changesets will create the initial `0.1.0` entry.
