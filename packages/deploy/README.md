# @kingstack/deploy

Versioned hosted deployment tooling for generated KingStack projects.

The package owns KingStack's NestJS/DigitalOcean, hosted Supabase, and Vercel
configuration commands. It is intentionally KingStack-specific and does not
rewrite project-owned Dockerfiles, schemas, workflows, or migrations.

## Installation

Generated projects install an explicit version as a development dependency:

```bash
yarn add --dev --exact @kingstack/deploy@0.1.0
```

The package never updates itself and installing it does not contact a provider
or perform a deployment. The CLI requires Bun 1.2.8 or newer.

## Commands

```bash
king-deploy --help

king-deploy nest
king-deploy nest provision production --region nyc3 --deploy
king-deploy nest deploy production

king-deploy supabase provision
king-deploy supabase pull production
king-deploy supabase auth production

king-deploy vercel pull production
```

Use `--cwd <path>` before the provider name to operate on another KingStack
project root. Every command performs its scoped compatibility and provider
preflight before mutation.

Generated projects retain their familiar Yarn aliases, including
`yarn deploy:nest`, `yarn supabase:provision`, and
`yarn vercel:config:pull`.

Provider tools remain project or system prerequisites:

- Supabase CLI `>=2.113.0 <3` and Vercel CLI `>=58.1.0 <59` are optional peers
  used only by their provider commands.
- Nest deployment requires `doctl`, Docker, SSH, SCP, gzip, Git, and Bash for
  the selected operation.
- Provider authentication is never performed during package installation.

## Upgrade safety

Review the dependency and changelog before upgrading. Then inspect the intended
provider plan without making changes:

```bash
yarn up --exact @kingstack/deploy@<reviewed-version>
git diff
yarn deploy:nest deploy production --dry-run
```

Do not run real deployments through an unpinned `@latest` download. Database
migrations are durable and cannot be automatically rolled back with the
application container.

To downgrade, restore the previous exact dependency and lockfile, rerun the
tests, and inspect another dry run. A downgrade changes local tooling only; it
cannot reverse durable provider settings or database migrations.

## Migrating a project with copied deployment scripts

Install the reviewed release, switch the compatibility aliases shown above to
`king-deploy`, and verify them before deleting the old implementation:

```bash
yarn add --dev --exact @kingstack/deploy@0.1.0
yarn test
yarn deploy:nest deploy production --dry-run
```

After those commands use the package successfully, remove only the old
`scripts/deploy` directory. Keep `config/`, Dockerfiles, Prisma migrations,
workflows, provider link metadata, and the remaining local-development scripts.

See the generated project's deployment guide for provider setup, billing,
routing, and operational recovery details.
