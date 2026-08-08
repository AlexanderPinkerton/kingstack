# Configuration and secrets

KingStack's configuration source of truth is `@kingstack/config`:

- `config/schema.ts` defines values, validation, computed outputs, generated
  files, and external service mappings.
- `config/<environment>.ts` contains environment-specific inputs and is ignored
  when it contains real credentials.
- generated `.env` files are outputs and must not be edited directly.

Start an environment from the checked-in example:

```bash
cp config/example.ts config/local.ts
yarn king-config check local
yarn env:local
```

Hosted environments follow the same pattern:

```bash
yarn king-config env init development
yarn king-config check development
yarn env:development
```

Inspect external changes before synchronizing GitHub and Vercel:

```bash
yarn deploy:sync-secrets:dry-run
yarn deploy:sync-secrets:dev
yarn deploy:sync-secrets:prod
```

Never commit environment value files containing credentials. Never place a
database password, Supabase secret key, refresh token, user access token, or AI
provider key in a `NEXT_PUBLIC_*` value.

See the current [configuration guide](../../config/readme.md) for schema,
generation, environment, and synchronization details. See
[KingStack authentication](../auth/README.md) for the exact role of Supabase
publishable keys, secret keys, cookies, and user access tokens.
