#!/usr/bin/env bun
import { execSync } from 'child_process';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { defineValues, resolveConfig } from '@kingstack/config';

/**
 * Automates the creation of a shadow database for Prisma local development with Supabase.
 * Usage: bun scripts/setup-shadow-db.ts [env]
 */

async function run(command: string) {
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

async function loadConfigForEnv(env: string) {
    const cwd = process.cwd();

    // Load schema
    const schemaPath = resolve(cwd, "config/schema.ts");
    if (!existsSync(schemaPath)) throw new Error(`Schema not found: ${schemaPath}`);
    const { schema } = await import(schemaPath);

    // Load values
    const valuesPath = resolve(cwd, `config/${env}.ts`);
    if (!existsSync(valuesPath)) throw new Error(`Config values not found: ${valuesPath}`);
    const { values } = await import(valuesPath);

    return resolveConfig(schema, values);
}

async function main() {
    const env = process.argv[2] || "local";
    console.log(`👻 Application: Shadow Database Setup (${env})`);
    console.log('-------------------------------------');

    // 1. Load Config
    console.log(`📖 Loading configuration for '${env}'...`);
    let projectId;
    try {
        const { config, errors } = await loadConfigForEnv(env);
        if (errors.length > 0) {
            console.error('❌ Configuration errors:', errors);
            process.exit(1);
        }
        projectId = config.all.SUPABASE_PROJECT_REF; // In local mode, REF usually acts as ID/Name suffix

        // If it's a "remote" ref (like 'iytsajmbf...') but we are in local environment type,
        // we might be looking for the local container name which usually follows the project_id in config.toml
        // But the user defines SUPABASE_PROJECT_ID in their schema for this.
        // Let's check SUPABASE_PROJECT_ID if available, else REF.

        // In the user's schema, SUPABASE_PROJECT_REF is the key. 
        // In local.ts, the user likely sets this to "kingstack-local" for the local instance
        // or the docker container name suffix.
    } catch (e: any) {
        console.error(`❌ Failed to load config: ${e.message}`);
        process.exit(1);
    }

    if (!projectId) {
        console.error("❌ Could not determine SUPABASE_PROJECT_REF from config.");
        process.exit(1);
    }

    console.log(`🎯 Target Project ID: ${projectId}`);

    // 2. Find the Supabase DB container
    console.log('🔍 Finding Supabase DB container...');
    let containerId = '';
    try {
        const containerNameTarget = `supabase_db_${projectId}`;
        const containers = (await run('docker ps --format "{{.Names}}"')).split('\n');

        // Exact match preferred, or contains strict suffix
        containerId = containers.find(name => name === containerNameTarget) || '';

        if (!containerId) {
            console.error(`❌ Could not find container named '${containerNameTarget}'`);
            console.error('   Running containers:', containers.join(', '));
            process.exit(1);
        }
        console.log(`✅ Found container: ${containerId}`);
    } catch (e) {
        console.error('❌ Error listing docker containers. Is Docker running?');
        process.exit(1);
    }

    // 3. Drop and Create `shadow_db`
    console.log('\n🗑️  Recreating shadow_db...');
    try {
        run(`docker exec ${containerId} psql -U postgres -c "DROP DATABASE IF EXISTS shadow_db WITH (FORCE);"`);
        run(`docker exec ${containerId} psql -U postgres -c "CREATE DATABASE shadow_db;"`);
        console.log('✅ shadow_db created.');
    } catch (e) {
        console.error('❌ Failed to create shadow_db.');
        process.exit(1);
    }

    // 4. Clone Schema (System Schemas + Public)
    console.log('\n🧬 Cloning system schemas from `postgres`...');
    try {
        const dumpCmd = `docker exec ${containerId} pg_dump -U postgres --schema-only postgres`;
        const restoreCmd = `docker exec -i ${containerId} psql -U postgres shadow_db`;
        execSync(`${dumpCmd} | ${restoreCmd}`, { stdio: 'ignore' });
        console.log('✅ Schema cloned.');
    } catch (e) {
        console.error('❌ Failed to clone schema.');
        console.error(e);
        process.exit(1);
    }

    // 5. Reset Public Schema
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
        console.warn('⚠️  Some permission grants may have warned, but schema is reset.');
    }

    console.log('\n✨ Shadow DB setup complete! You can now run `prisma migrate dev`.');
}

main();
