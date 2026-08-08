# Provision a Hosted Supabase Project

KingStack includes a guarded wrapper around Supabase CLI project creation. It
collects the project name, organization, region, and optional compute size,
explains the billing boundary, and asks for confirmation before creating
anything.

```bash
yarn supabase:provision
```

The script uses the checked-in Supabase CLI instead of maintaining a separate
Management API client. Authenticate once before provisioning:

```bash
yarn exec supabase login
```

## Preview a repeatable plan

Every interactive choice can also be supplied as a flag. A dry run checks the
local CLI and prints the plan without creating a cloud resource:

```bash
yarn supabase:provision my-app \
  --org-id example-org \
  --region us-east-1 \
  --dry-run
```

Omit `--size` unless you deliberately want paid compute larger than the
organization default. For example:

```bash
yarn supabase:provision my-app \
  --org-id example-org \
  --region us-east-1 \
  --size small
```

Run `yarn supabase:provision --help` for the supported regions and compute
sizes.

The region menu intentionally matches the exact region enum supported by the
Supabase CLI version pinned in `package.json`. Supabase may advertise newer
regions before KingStack upgrades that dependency; unsupported regions are
omitted so the script cannot build a plan that the installed CLI will reject.

## Billing boundary

A project inherits the subscription plan of its organization. Project creation
does not select or change that plan.

- Free organizations cost $0 and are limited to two active projects across
  organizations where a user is an Owner or Admin. Inactive projects may pause.
- Pro starts at $25 per month for the organization and includes $10 in monthly
  compute credits. Each running project consumes compute independently.
- Compute is charged hourly and is not covered by the Pro spend cap.
- Storage, egress, authentication, and other usage may add charges or reach plan
  quotas.

Prices change. Verify Supabase's [pricing](https://supabase.com/pricing),
[billing guide](https://supabase.com/docs/guides/platform/billing-on-supabase),
and [compute pricing](https://supabase.com/docs/guides/platform/manage-your-usage/compute)
before confirming a billable project.

## Password handling

The KingStack wrapper never accepts or logs the database password. After the
final confirmation, Supabase CLI requests it through its own secure terminal
prompt.

Enter and save a password instead of leaving the prompt blank. CLI `2.112.0`
generates a password for a blank response but does not return or persist that
generated value after project creation.

Project creation deliberately uses Supabase's interactive text output. CLI
`2.112.0` disables missing-value prompts when structured output is requested,
so adding `--output json` would require exposing the database password as a
command argument. Supabase prints the new project reference in its text output
instead.

The command also passes `--agent no`. Supabase CLI otherwise auto-detects agent
environments and changes them to non-interactive output even when a person is
using a real terminal through an automation wrapper.

For that reason, project creation requires an interactive terminal even when
`--yes` skips KingStack's final confirmation. `--dry-run` can run
non-interactively when the project name, organization, and region are supplied.

## Import the project credentials

Project creation deliberately stops before changing local configuration. The
credential importer is a separate, rerunnable command, so a failed import never
requires creating another billable project.

Write the five Supabase inputs into an ignored KingStack environment file:

```bash
yarn supabase:provision:get-secrets development \
  --project-ref <project-ref>
```

Omit `--project-ref` to choose from the projects available through the current
Supabase login. Omit the environment as well to choose `development`,
`production`, or an explicit terminal printout interactively.

The importer:

- retrieves the project reference, AWS region, and API keys through the pinned
  Supabase CLI;
- requires a modern `sb_publishable_...` and `sb_secret_...` key pair, preferring
  the pair named `default`;
- asks for the unrecoverable database password in a masked prompt;
- updates only the five Supabase properties in an existing values file; and
- refuses to write a values file that Git does not ignore.

If a project has multiple named API key pairs, select one explicitly:

```bash
yarn supabase:provision:get-secrets development \
  --project-ref <project-ref> \
  --api-key-name kingstack
```

Older projects may expose only legacy `anon` and `service_role` keys. The
importer deliberately rejects those. Create a publishable and secret pair in
**Settings → API Keys**, then rerun the command.

Supabase's project listing exposes the AWS region but not the project's exact
pooler shard. KingStack defaults `SUPABASE_REGION` to `aws-0-<region>`. Compare
that with the transaction-pooler hostname in the Dashboard's **Connect** dialog
and override it when necessary:

```bash
yarn supabase:provision:get-secrets development \
  --project-ref <project-ref> \
  --pooler-region aws-1-us-east-2
```

For non-interactive automation, pass the database password through the process
environment rather than an argument, and acknowledge the write explicitly:

```bash
SUPABASE_DB_PASSWORD='<database-password>' \
  yarn supabase:provision:get-secrets development \
  --project-ref <project-ref> \
  --yes
```

To inspect a complete TypeScript values block instead of writing a file, use
`--print`. This prints the secret key and database password to the terminal and
must not be used in CI logs or copied into a tracked file:

```bash
yarn supabase:provision:get-secrets --print \
  --project-ref <project-ref>
```

## Complete the application handoff

After importing credentials:

1. Validate the imported runtime configuration. KingStack supplies its standard
   application ports, and deployment-provider credentials are validated later
   when they are used:

   ```bash
   yarn king-config check <environment>
   ```

2. Link the workspace when using CLI commands that require a linked project:

   ```bash
   yarn exec supabase link --project-ref <project-ref>
   ```

3. In **Authentication → Signing Keys**, confirm the project uses an
   asymmetric signing key. If migrating an older project, deploy KingStack's
   JWKS-capable verifier before rotating the key and follow Supabase's waiting
   period before revoking the legacy key.

4. Generate service environment files and apply Prisma migrations:

   ```bash
   yarn king-config check development
   yarn env:development
   yarn prisma:deploy
   ```

5. Inspect external secret changes before syncing them:

   ```bash
   yarn deploy:sync-secrets:dry-run
   ```

Keeping these phases separate ensures project creation cannot silently rewrite
secrets or deploy a database schema.
