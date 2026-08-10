# @kingstack/deploy

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
