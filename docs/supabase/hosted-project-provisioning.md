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
prompt and stores it using the credential storage supported by the CLI.

For that reason, project creation requires an interactive terminal even when
`--yes` skips KingStack's final confirmation. `--dry-run` can run
non-interactively when the project name, organization, and region are supplied.

## Complete the application handoff

Project creation deliberately stops before changing local configuration or
deploying a schema. After Supabase returns the project reference:

1. Link the workspace:

   ```bash
   yarn exec supabase link --project-ref <project-ref>
   ```

2. Inspect the project's API keys:

   ```bash
   yarn exec supabase projects api-keys --project-ref <project-ref>
   ```

3. Create `config/development.ts` or `config/production.ts` from
   `config/example.ts`, then set the hosted Supabase project reference, region,
   database password, and API keys.

4. Generate service environment files and apply Prisma migrations:

   ```bash
   yarn env:development
   yarn prisma:deploy
   ```

5. Inspect external secret changes before syncing them:

   ```bash
   yarn deploy:sync-secrets:dry-run
   ```

Keeping these phases separate ensures a provisioning command cannot silently
rewrite secrets or deploy a database schema.
