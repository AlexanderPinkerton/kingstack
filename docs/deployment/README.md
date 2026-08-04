# Deployment

KingStack deploys the Next.js application to Vercel and can deploy the NestJS
application as a Docker container on one or more DigitalOcean Droplets.

## NestJS on DigitalOcean

The Nest deployment tool has two explicit operations:

```bash
# First-time infrastructure
yarn deploy:nest provision production --region nyc3

# Build, migrate, and deploy to every matching droplet
yarn deploy:nest deploy production
```

Provisioning and deployment are separate so an ordinary release can never
silently create billable infrastructure.

For a first deployment, run both phases with one confirmation:

```bash
yarn deploy:nest provision production --region nyc3 --deploy
```

This deploys only the newly provisioned or explicitly reused host. It does not
redeploy every other host carrying the same fleet tag.

### Prerequisites

- Docker running locally for full image deployments.
- `doctl` authenticated with `doctl auth init`.
- SSH and SCP.
- A `config/<environment>.ts` file containing the hosted Supabase and
  application values.
- At least one SSH public key uploaded to DigitalOcean.

Hosted configurations must use `LOG_FORMAT: "json"`. Pretty logging is
local-only, and the deployment preflight rejects it before building an image or
changing cloud resources.

The script resolves KingStack configuration in memory. It does not rewrite
`supabase/config.toml`, and it never includes `.env` files in the Docker build.

### Configuration and defaults

The root package name determines the application slug. For a project named
`my-app`, production defaults to:

```text
Droplet tag:    my-app-production-nest
Container:      my-app-nest
Cloud firewall: my-app-production-nest-firewall
```

When `NEXT_PUBLIC_NEST_BACKEND_URL` resolves to a non-local HTTPS URL, its
hostname becomes the default Caddy domain. Override that behavior explicitly:

```bash
yarn deploy:nest deploy production --domain api.example.com
yarn deploy:nest deploy production --no-domain
```

`--domain` binds Nest to loopback and routes ports 80/443 through Caddy.
`--no-domain` publishes the configured Nest port and opens only that app port
in the project-owned DigitalOcean Cloud Firewall.

### Provision a droplet

```bash
yarn deploy:nest provision production \
  --region nyc3 \
  --size s-1vcpu-1gb
```

Provisioning creates an Ubuntu 24.04 x64 Droplet, applies the environment tag,
enables monitoring and private networking, installs Docker and Caddy through
cloud-init, and creates a tag-based cloud firewall. Root login is key-only;
password authentication is disabled.

Useful options:

```text
--name <name>         Name a new host or reuse an exact existing host
--ssh-key <value>     Choose an SSH key by ID, fingerprint, or name
--ssh-source <cidr>   Restrict SSH; repeat for multiple source networks
--backups             Enable billable DigitalOcean backups
--deploy              Deploy to this host after provisioning
--dry-run             Resolve and print the plan without changing resources
--yes                 Skip the interactive confirmation
```

If there is exactly one DigitalOcean SSH key, it is selected automatically.
Otherwise `--ssh-key` is required. SSH defaults to all IPv4 and IPv6 sources;
production installations should normally restrict it with `--ssh-source`.

To add another host to a fleet, provision a unique name using the same
environment. Deployment automatically finds every active host with the shared
tag.

### Deploy to existing droplets

Existing hosts must be x86_64 machines reachable as `root` over SSH with Docker
installed. Select all tagged droplets or explicit names/IDs:

```bash
yarn deploy:nest deploy production --tag custom-production-tag

yarn deploy:nest deploy production \
  --droplet api-production-1 \
  --droplet api-production-2
```

When Caddy is required on an existing Ubuntu host, the tool installs it using
the official package repository without reinstalling Docker. Its configuration
lives in an app-specific file under `/etc/caddy/conf.d`; unrelated Caddy sites
are not replaced.

### Release behavior

A full deployment:

1. validates all local and remote prerequisites;
2. builds one `linux/amd64` Nest image;
3. runs `prisma migrate deploy` once;
4. streams the image directly to each host over SSH;
5. starts and probes a candidate container before cutover;
6. replaces the active container and verifies it again; and
7. validates and gracefully reloads Caddy when configured.

Droplets are updated sequentially. If a host fails, its previous container is
restored and already-updated hosts are rolled back when they have a previous
revision. Database migrations are not reversible, so production migrations
must remain compatible with both the outgoing and incoming application
versions.

Only the current and previous application revisions are retained remotely.
The tool never runs a global Docker prune and does not require DigitalOcean
Container Registry.

For configuration-only changes:

```bash
yarn deploy:nest deploy production --env-only
```

This reuses each host's current image and skips the Docker build, upload, and
database migration.

If the database exists but migrations are managed separately, skip only the
migration phase:

```bash
yarn deploy:nest deploy development --skip-migrations
```

If the project has no reachable database yet, explicitly disable the startup
connection as well:

```bash
yarn deploy:nest deploy development --without-database

# Or during first-time provisioning:
yarn deploy:nest provision development --region nyc3 \
  --deploy \
  --without-database
```

`--without-database` also skips migrations. The base Nest service can start,
but database-backed endpoints remain unavailable until a database is
configured and the application is redeployed without this flag. Skipping only
migrations transfers responsibility for schema compatibility to the operator.

Inspect a release without changing Docker, the database, DigitalOcean, or a
remote host:

```bash
yarn deploy:nest deploy production --dry-run
```

### DNS and troubleshooting

The script does not create DNS records. Before expecting HTTPS to work, point
the chosen hostname at the Droplet IPs. Caddy retries certificate issuance when
DNS becomes available.

```bash
# Application logs
ssh root@DROPLET_IP 'docker logs my-app-nest --tail 100'

# Provisioning logs
ssh root@DROPLET_IP 'journalctl -u cloud-init --no-pager'
ssh root@DROPLET_IP 'cat /var/log/cloud-init-output.log'

# Caddy logs and validation
ssh root@DROPLET_IP 'journalctl -u caddy --no-pager -n 100'
ssh root@DROPLET_IP 'caddy validate --config /etc/caddy/Caddyfile'
```

## Next.js on Vercel

### First deployment through the Vercel dashboard

The recommended Vercel project root is `apps/next`:

1. Import the Git repository in Vercel.
2. Set **Root Directory** to `apps/next`.
3. Keep the checked-in Framework, Build Command, and Output Directory values.
4. Add the hosted environment variables before deploying the full application.

The app-local `vercel.json` runs Turbo from the monorepo root so Prisma and
project-owned workspace dependencies are prepared before Next.js builds. Its
output directory is `.next`, relative to `apps/next`. It is the repository's
only Vercel configuration; manual and CI commands still execute from the
monorepo root so Vercel uploads project-owned workspace dependencies.

Do not copy `apps/next/.next` into the Vercel dashboard's Output Directory when
the Root Directory is `apps/next`; that resolves to the nonexistent
`apps/next/apps/next/.next` path.

Vercel automatically detects the repository's Yarn workspace and skips
unaffected projects using the workspace dependency graph. No custom Ignored
Build Step is required.

For a backend-connected deployment, configure the variables listed under the
`vercel` service in `config/schema.ts`. You can inspect the intended changes
before synchronizing them:

```bash
yarn deploy:sync-secrets:dry-run
```

### Automated deployments

The checked-in GitHub Actions workflows deploy Next.js from explicit branches:

- `development` creates a Vercel preview deployment.
- `main` deploys the Vercel production environment.

Both workflows run Prisma deployment migrations before Vercel deployment.
Required GitHub environment secrets include the Supabase database URLs,
Supabase public values, and Vercel token/project identifiers. Use
`yarn deploy:sync-secrets:dry-run` before synchronizing environment secrets.
The project referenced by `VERCEL_PROJECT_ID` must have its Vercel Root
Directory set to `apps/next`. The Actions run from the repository root, and
Vercel uses that project setting to load the sole app-local `vercel.json` while
including the rest of the Yarn workspace in the deployment.

### Manual deployment without GitHub linking

The manual path does not require a GitHub connection or a separate
`vercel link` command. Run it from the repository root:

```bash
# Use a globally installed Vercel CLI
vercel

# Or use the repository command
yarn vercel

# Explicit production deployment after initial setup
yarn vercel:prod
```

On the first deployment, Vercel CLI authenticates the user and creates or
selects the Vercel project as part of the deployment flow. Current Vercel CLI
versions may detect `apps/nest` as a possible Vercel Service before they read
the Next.js-specific configuration. Choose these answers:

| Prompt                                  | Answer                              |
| --------------------------------------- | ----------------------------------- |
| Which project?                          | Create a new project                |
| Name?                                   | Accept or enter the project name    |
| How would you like to set up this project? | Choose a different root directory |
| Code directory?                         | `apps/next`                         |
| Customize settings?                     | No                                  |

Do not select the detected NestJS service or set up all detected services.
KingStack deploys NestJS separately; this Vercel project owns only the Next.js
application. Before creating the project, the CLI should report the checked-in
settings:

```text
Build Command: cd ../.. && yarn turbo run build --filter=@your-project/next
Framework: nextjs
Output Directory: .next
```

Vercel assigns a project's first deployment to production even when the command
does not include `--prod`. Later plain `vercel` or `yarn vercel` commands create
preview deployments; use `vercel --prod` or `yarn vercel:prod` to update
production explicitly.

After the first deployment, Vercel saves the project association in the
gitignored `.vercel` directory for subsequent commands. This is a Vercel
project association, not a GitHub integration.

#### Repairing an older generated project

Older KingStack templates used `apps/next/.next` in the app-local
`apps/next/vercel.json`. When `apps/next` is also the Vercel Code Directory,
Vercel resolves that value as the nonexistent
`apps/next/apps/next/.next` directory and reports that the Next.js output was
not found.

Replace the build-related fields in `apps/next/vercel.json` with the following,
substituting the actual workspace namespace from `apps/next/package.json` for
`@your-project`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd ../.. && yarn turbo run build --filter=@your-project/next",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

Preserve the existing `git` block if GitHub Actions owns deployments for the
project. Remove the old `installCommand`, `devCommand`, and `ignoreCommand`
fields. Vercel detects the Yarn install automatically, and its workspace graph
accounts for changes outside `apps/next`.

Delete the legacy root-level `vercel.json`, if present. In the Vercel project
settings, confirm that **Root Directory** is `apps/next` before running a manual
deployment or the checked-in GitHub Actions workflows.

Also change the root `package.json` scripts so manual deployments execute from
the monorepo root:

```json
{
  "scripts": {
    "vercel": "vercel deploy",
    "vercel:prod": "vercel deploy --prod"
  }
}
```

The failed first attempt already created the Vercel project and local
`.vercel/project.json`. After making these changes, deploy it again from the
repository root without recreating or relinking anything:

```bash
vercel --prod
```

KingStack's app-specific Turbo configuration already declares `.next/**` as a
build output. Do not add `apps/next/.next/**` to the root Turbo outputs in
response to Vercel's generic error message.

For CI or another stateless environment, provide `VERCEL_ORG_ID` and
`VERCEL_PROJECT_ID`; Vercel CLI uses those values without requiring a local
project link. The checked-in GitHub workflows already use this path.
