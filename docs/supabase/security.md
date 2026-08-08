# Supabase Data API Security

KingStack keeps the Supabase Data API enabled for its server-only realtime
integration, but application tables are private by default.

The `20260729033000_secure_public_schema_by_default` Prisma migration:

- revokes all table, sequence, and function privileges from `anon` and
  `authenticated`;
- enables RLS on every existing table in the exposed `public` schema;
- changes PostgreSQL default privileges so future Prisma objects are not
  automatically exposed; and
- installs a PostgreSQL event trigger that enables RLS whenever Prisma creates
  another table in `public`.

Prisma's database-owner connection and Supabase's `service_role` continue to
work. RLS is not forced on the table owner.

## Backend-only tables

Nothing else is required for a table that is accessed only through Next.js,
NestJS, or Prisma. It remains unavailable through the publishable/anonymous
Supabase API key.

## Deliberately exposing a table

Direct browser access requires both PostgreSQL privileges and an RLS policy.
Add both in the feature's Prisma migration rather than changing the global
defaults.

For example, a user-owned table with a text `user_id` can grant authenticated
users access to their own rows:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.example
TO authenticated;

CREATE POLICY "Users can read their own example rows"
ON public.example
FOR SELECT
TO authenticated
USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid())::TEXT = user_id
);

CREATE POLICY "Users can create their own example rows"
ON public.example
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid())::TEXT = user_id
);

CREATE POLICY "Users can update their own example rows"
ON public.example
FOR UPDATE
TO authenticated
USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid())::TEXT = user_id
)
WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid())::TEXT = user_id
);

CREATE POLICY "Users can delete their own example rows"
ON public.example
FOR DELETE
TO authenticated
USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid())::TEXT = user_id
);
```

Policies cannot be generated safely for every table because ownership and
public-access semantics differ by feature. The automatic event trigger supplies
the safe default; a feature migration supplies the intentional exception.

## Auditing exposed tables

This query should return no rows:

```sql
SELECT
    namespace.nspname AS schema_name,
    relation.relname AS table_name
FROM pg_class AS relation
JOIN pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
    AND relation.relkind IN ('r', 'p')
    AND NOT relation.relrowsecurity;
```

## Disabling the Data API

Supabase currently leaves PostgREST running when the Data API is disabled and
configures an intentionally nonexistent schema named
`pg_pgrst_no_exposed_schemas`. This can produce recurring `3F000` log entries.
Supabase documents those entries as harmless.

Disabling the API also breaks KingStack's current realtime startup probe because
the NestJS gateway verifies its secret-key PostgREST access before subscribing.
That trusted client assumes Supabase's PostgreSQL `service_role`. Keep the API
enabled when using the bridge, or remove the probe if you deliberately choose a
fully disabled Data API.
