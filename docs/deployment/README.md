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

### Prerequisites

- Docker running locally for full image deployments.
- `doctl` authenticated with `doctl auth init`.
- SSH and SCP.
- A `config/<environment>.ts` file containing the hosted Supabase and
  application values.
- At least one SSH public key uploaded to DigitalOcean.

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

The checked-in GitHub Actions workflows deploy Next.js from explicit branches:

- `development` deploys the Vercel development environment.
- `main` deploys the Vercel production environment.

Both workflows run Prisma deployment migrations before Vercel deployment.
Required GitHub environment secrets include the Supabase database URLs,
Supabase public values, and Vercel token/project identifiers. Use
`yarn deploy:sync-secrets:dry-run` before synchronizing environment secrets.

The manual Vercel commands remain available:

```bash
yarn vercel
yarn vercel:prod
```
