# @kingstack/email

## 0.2.0

### Minor Changes

- 7539f2b: Sync supported Supabase settings and configured email templates through the
  existing Supabase CLI in normal configuration sync. Render the selected
  environment into temporary files without switching the running application's
  configuration. SMTP and templates remain optional for new projects. Add boolean
  and numeric TOML generation and drift checks.

  Remove the email package's separate hosted Management API sync engine. In 0.2,
  auth sync/policy commands direct users to normal config sync; hosted programmatic
  helpers and environment adapters are removed. Local rendering, preview, template
  export, and application delivery remain available without KingStack config.

  Generate new projects with config 0.5.x and the Supabase CLI sync service.

## 0.1.0

### Minor Changes

- ea0ab83: Add reusable React Email layouts and six configurable Supabase auth templates,
  Resend application delivery with explicit local capture, and project-aware
  template export/preview and hosted SMTP setup. Authentication policy changes
  are separate, explicit operations. Include secret-redacted dry runs, private
  rollback snapshots, and packed-consumer tests for React 18/19 and CommonJS/ESM.
