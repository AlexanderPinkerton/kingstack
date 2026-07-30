-- KingStack accesses application tables through Prisma and uses the Supabase
-- service role for its realtime bridge. Browser roles receive no direct table
-- access unless a later feature migration deliberately grants it.
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
FROM anon, authenticated;

REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
FROM anon, authenticated;

REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public
FROM PUBLIC, anon, authenticated;

-- Undo the permissive defaults installed by the original essentials
-- migration. These rules apply to objects subsequently created by postgres,
-- which is the role used by the Prisma migration connection.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Protect every existing application table. With RLS enabled and no policy,
-- access through anon/authenticated is denied even if privileges are granted
-- accidentally later.
DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN
        SELECT namespace.nspname AS schema_name, relation.relname AS table_name
        FROM pg_class AS relation
        JOIN pg_namespace AS namespace
            ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
            AND relation.relkind IN ('r', 'p')
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
            table_record.schema_name,
            table_record.table_name
        );
    END LOOP;
END;
$$;

-- Prisma creates tables with raw SQL, so Supabase does not automatically
-- enable RLS as it does for tables created through the dashboard. This event
-- trigger makes future public tables default-deny as soon as they are created.
CREATE SCHEMA IF NOT EXISTS kingstack_internal AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA kingstack_internal FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION kingstack_internal.enable_rls_on_new_public_table()
RETURNS EVENT_TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    command RECORD;
BEGIN
    FOR command IN
        SELECT *
        FROM pg_event_trigger_ddl_commands()
        WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
            AND object_type IN ('table', 'partitioned table')
    LOOP
        IF command.schema_name = 'public' THEN
            EXECUTE format(
                'ALTER TABLE IF EXISTS %s ENABLE ROW LEVEL SECURITY',
                command.object_identity
            );
        END IF;
    END LOOP;
END;
$$;

REVOKE ALL
ON FUNCTION kingstack_internal.enable_rls_on_new_public_table()
FROM PUBLIC, anon, authenticated;

DROP EVENT TRIGGER IF EXISTS kingstack_ensure_public_table_rls;

CREATE EVENT TRIGGER kingstack_ensure_public_table_rls
    ON ddl_command_end
    WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
    EXECUTE FUNCTION kingstack_internal.enable_rls_on_new_public_table();
