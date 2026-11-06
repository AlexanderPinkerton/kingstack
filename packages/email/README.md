# @kingstack/email

React Email layouts and authentication templates, Resend application delivery,
and Supabase email setup tooling. The runtime supports Node.js 20+ and React
18.3/19. The CLI requires Bun 1.2.8+ to load project TypeScript configuration.

## Install

```sh
yarn add @kingstack/email react react-dom
# For the default hosted environment resolver:
yarn add -D @kingstack/config
# Optional interactive preview (install the matching UI version too):
yarn add -D react-email@6.11.3 @react-email/ui@6.11.3
```

Declare dependencies in the workspace that imports them. Projects that import
`@react-email/components` in their own templates should declare it themselves.
Resend and the render/component libraries are ordinary dependencies. React and
React DOM are peers; the preview CLI is optional. KingStack config is not an email runtime dependency.
The package's root export is configuration/types only. `/server`, `/auth`, and
`/supabase` belong in backend or tooling code, never a browser bundle.

## Configure each app

```ts
// email.config.ts
import { defineEmailConfig } from "@kingstack/email";

export default defineEmailConfig({
  brand: {
    name: "My App",
    wordmark: "MyApp",
    tagline: "A short description.",
    accentColor: "#2563eb",
  },
  from: { name: "My App", email: "support@example.com" },
  replyTo: "support@example.com",
  auth: {
    copy: {
      confirmation: {
        body: "Verify your email to finish setting up your account.",
      },
    },
  },
});
```

The six auth kinds are `confirmation`, `recovery`, `email_change`, `magic_link`,
`invite`, and `reauthentication`. Copy overrides accept `subject`, `heading`,
`preview`, `body`, `action`, `reassurance`, and `unsolicited`. Subjects receive
the ` | Brand name` suffix. `auth.templates[kind]` can supply a custom React
component receiving `AuthEmailTemplateProps`; preserve the supplied action URL
or reauthentication code. Supabase inserts its own links at send time.

`brand.logo` accepts `{ src, width, height, alt? }` for a publicly hosted HTTPS
raster wordmark. Supply its display dimensions; the default layout keeps it
responsive and uses the brand name as alt text. `EmailLayout` supplies readable
foreground colors for ordinary children, including plain paragraphs. Custom
email content should still set text colors inline for mail-client consistency.

For server-side callbacks that must work in another browser, configure
`auth.actionUrls` per auth kind (except reauthentication), for example:

```ts
auth: {
  actionUrls: {
    recovery: "{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery",
  },
}
```

Each URL must begin with `{{ .SiteURL }}/` or `{{ .RedirectTo }}` followed by
`?` or `&`, and retain `{{ .TokenHash }}`. With `RedirectTo`, the app must supply
an allowlisted callback and choose the correct query separator. The consuming
route validates the token using `verifyOtp`; a pre-existing login is not evidence
that a recovery link succeeded. Static previews replace these URLs with inert
examples. Default links remain unchanged for other consumers. Token-hash links
automatically omit the same-browser instruction; `auth.copy[kind].linkHint`
overrides the helper text for either link style.

`replyTo` applies to application messages. Supabase SMTP uses its configured
sender as the reply destination; use a working mailbox/alias. Auth footers use
`brand.supportEmail`, falling back to `replyTo` and then `from.email`.

## Send application emails

```tsx
import { createMailer } from "@kingstack/email/server";
import { EmailLayout } from "@kingstack/email/react";
import config from "./email.config";

const mailer = createMailer({
  config,
  environment: "production",
  delivery: { type: "resend", apiKey: process.env.RESEND_API_KEY! },
});

await mailer.send({
  to: "recipient@example.com",
  subject: "Welcome!",
  react: (
    <EmailLayout
      brand={config.brand}
      preview="Your account is ready."
      siteUrl="https://example.com"
    >
      <p>Welcome to your account.</p>
    </EmailLayout>
  ),
  idempotencyKey: "welcome/user-id",
});
```

Pass either `react` or `html`, optionally `text`, `from`, and `replyTo`. React
messages get both HTML and plain text. Results are `{ status: "accepted", id }`;
acceptance by Resend does not prove inbox delivery. Provider failures throw
without exposing email bodies or credentials in error text. The caller owns
durable queues and retry policy. Keep the same payload/key on retries; Resend's
deduplication window is finite (24 hours), not a permanent delivery guarantee.

For local/testing use `environment: "local"` or `"test"` and
`delivery: { type: "capture", directory: ".local/emails" }`. It writes private
HTML and JSON files without making provider requests. Capture is rejected for
hosted environments and whenever `NODE_ENV=production`. Missing delivery
configuration never silently becomes a successful send. Ignore `.local/` in Git.

## Supabase authentication emails

Supabase generates and verifies authentication tokens. This package renders
subjects and HTML; hosted deployment belongs to the project's config workflow.

1. Configure branding, components, copy, and action URLs in `email.config.ts`.
2. Export HTML files and their subject/path entries into `supabase/config.toml`.
3. Configure SMTP, Auth URLs, and verification policy through normal config.
   KingStack config 0.5+ supports a `provider: "supabase"` service using the
   existing TOML mapping. Keep SMTP secrets in environment references.
4. Authenticate with `yarn supabase login` or `SUPABASE_ACCESS_TOKEN` and run
   normal sync. The Supabase CLI ships templates and supported settings together.

```sh
king-email preview
king-email auth export
king-email auth export --check
king-config sync --env production --dry-run
king-config sync --env production
```

Custom templates and custom SMTP are independently optional. A new KingStack
project needs neither this package nor Resend credentials to sync configuration.
When adding Resend, verify the sending domain and configure SMTP deliberately.
Test delivery and callbacks before requiring verification. Already confirmed
accounts are not retroactively verified by changing policy.

### Migrating from 0.1

Version 0.2 removes hosted deployment from the email package. Replace `auth sync`
and `auth policy` with normal config sync; retired commands fail with guidance
before making changes. Programmatic Management API helpers, `syncAuthEmails`,
`setAuthVerificationPolicy`, hosted-environment types, `tooling.resolveEnvironment`,
and `auth.callbackPaths` are removed. Put canonical URLs and allowed callbacks in
the Supabase config mapping. `/supabase` still exports local `exportAuthEmails`.

Local Supabase sends auth email to its captured inbox (Mailpit); the application's
capture adapter writes files. Neither should send local fixture addresses to a
live provider. The initial setup still requires real signup/reset smoke tests
with an inbox you control. Test recovery and verification when a link opens in
a different browser already signed into another account. Token-hash callback URLs can support cross-browser verification;
validate that behavior with the consuming application's callback implementation. The consuming app owns callback routes and session handling.

`king-email preview` writes static safe examples with nonfunctional links;
`king-email preview --interactive` launches the project's React Email CLI.
`tooling.reactEmailDirectory` defaults to `emails`; provide preview components
there. No preview server is required for export, sync, or sending.

## Output paths

All CLI commands accept `--cwd` and `--config`. Tooling defaults:

| Setting                       | Default                |
| ----------------------------- | ---------------------- |
| `tooling.templatesDirectory`  | `supabase/templates`   |
| `tooling.supabaseConfigPath`  | `supabase/config.toml` |
| `tooling.previewDirectory`    | `.local/auth-emails`   |
| `tooling.reactEmailDirectory` | `emails`               |

Local export updates only a marked template block and refuses unmanaged
template definitions. It leaves all other TOML settings/comments intact.

## Development and validation

Before a registry release, validate a portable tarball in an isolated consumer:

```sh
yarn workspace @kingstack/config build
yarn workspace @kingstack/email build
yarn workspace @kingstack/email test
yarn workspace @kingstack/email test:pack
yarn workspace @kingstack/email pack --out /tmp/kingstack-email.tgz
# In an isolated consuming checkout:
yarn add @kingstack/email@file:/tmp/kingstack-email.tgz
```

`test:pack` installs the actual archive in isolated React 18 and React 19
consumers, checks CommonJS/ESM imports, legacy/NodeNext TypeScript resolution,
and runs local export/preview without optional peers or real email delivery.
Normal releases use Changesets and the configured trusted publisher. Use the
published registry version for application commits; temporary archive paths are
only for release-candidate validation.

Run `yarn test:config` from this package to validate packed config/email integration.
It checks a fresh project without email setup and a project with exported templates
through a fake Supabase CLI. No emails or hosted writes occur.
