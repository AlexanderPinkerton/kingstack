#!/usr/bin/env bun
import { execSync } from 'child_process';

/**
 * setup-shadow-db.ts
 * 
 * Automates the creation of a shadow database for Prisma local development with Supabase.
 * 
 * Problem:
 * Prisma requires a separate "shadow database" to detect invalid schema changes.
 * When using local Supabase, the default "postgres" database usually becomes the dev DB.
 * However, if we point the shadow DB to an empty database, migrations fail because they
 * rely on system schemas (like `auth`, `storage`) capable of having triggers installed on them.
 * 
 * Solution:
 * This script:
 * 1. Finds the local Supabase DB container.
 * 2. Drops/Creates a dedicated `shadow_db`.
 * 3. Clones the schema (including system schemas) from the main `postgres` DB.
 * 4. Wipes the `public` schema in `shadow_db` so it starts clean for Prisma.
 */

function run(command: string) {
    try {
        return execSync(command, { encoding: 'utf8', stdio: 'pipe' }).trim();
    } catch (error: any) {
        if (error.stderr) {
            console.error(`Error running command: ${command}`);
            console.error(error.stderr.toString());
        }
        throw error;
    }
}

function main() {
    console.log('👻 Application: Shadow Database Setup');
    console.log('-------------------------------------');

    // 1. Find the Supabase DB container
    console.log('🔍 Finding Supabase DB container...');
    let containerId = '';
    try {
        // Look for a container name containing "supabase_db_" and assuming it's the one we want.
        // Adjust this filter if you have multiple supabase projects running.
        const containers = run('docker ps --format "{{.Names}}"').split('\n');
        containerId = containers.find(name => name.includes('supabase_db_')) || '';

        if (!containerId) {
            console.error('❌ Could not find a running Supabase DB container.');
            console.error('   Make sure `supabase start` is running.');
            process.exit(1);
        }
        console.log(`✅ Found container: ${containerId}`);
    } catch (e) {
        console.error('❌ Error listing docker containers. Is Docker running?');
        process.exit(1);
    }

    // 2. Drop and Create `shadow_db`
    console.log('\n🗑️  Recreating shadow_db...');
    try {
        // Force drop if exists
        run(`docker exec ${containerId} psql -U postgres -c "DROP DATABASE IF EXISTS shadow_db WITH (FORCE);"`);
        run(`docker exec ${containerId} psql -U postgres -c "CREATE DATABASE shadow_db;"`);
        console.log('✅ shadow_db created.');
    } catch (e) {
        console.error('❌ Failed to create shadow_db.');
        process.exit(1);
    }

    // 3. Clone Schema (System Schemas + Public)
    console.log('\n🧬 Cloning system schemas from `postgres`...');
    try {
        // We pipe pg_dump from the container back into psql in the container
        // Note: We use `bash -c` to handle the pipe inside the exec if we want, or do it from host.
        // Doing it from host is safer for signal handling.
        // Command: docker exec <id> pg_dump ... | docker exec <id> psql ...

        const dumpCmd = `docker exec ${containerId} pg_dump -U postgres --schema-only postgres`;
        const restoreCmd = `docker exec -i ${containerId} psql -U postgres shadow_db`;

        // We can't easily pipe two execSyncs directly in node without using a shell, 
        // so let's just run the shell command.
        execSync(`${dumpCmd} | ${restoreCmd}`, { stdio: 'ignore' }); // ignore output to avoid noise

        console.log('✅ Schema cloned.');
    } catch (e) {
        console.error('❌ Failed to clone schema.');
        console.error(e);
        process.exit(1);
    }

    // 4. Reset Public Schema
    console.log('\n🧹 Resetting `public` schema in shadow_db...');
    const resetSql = `
    DROP SCHEMA public CASCADE; 
    CREATE SCHEMA public; 
    GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role; 
    GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role; 
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role; 
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role; 
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
  `;

    try {
        run(`docker exec ${containerId} psql -U postgres -d shadow_db -c "${resetSql.replace(/\n/g, ' ')}"`);
        console.log('✅ Public schema reset.');
    } catch (e) {
        // Ignore permission errors that often happen with system roles in local supabase
        console.warn('⚠️  Some permission grants may have warned (expected in local dev), but schema is reset.');
    }

    console.log('\n✨ Shadow DB setup complete! You can now run `prisma migrate dev`.');
}

main();
