import { resolve } from "path";
import { existsSync } from "fs";
import { ConfigSchema, ConfigValues } from "../core";

export async function loadUserSchema(cwd: string = process.cwd()): Promise<ConfigSchema> {
    const schemaPath = resolve(cwd, "config/schema.ts");
    if (!existsSync(schemaPath)) {
        throw new Error(`Schema file not found at ${schemaPath}`);
    }

    // Dynamic import of the schema file
    // Note: users must use 'bun' or 'ts-node' for this to work with .ts files directly
    // or compile their config first. For now, assuming bun/ts-node env.
    const imported = await import(schemaPath);
    return imported.schema;
}

export async function loadUserValues(env: string, cwd: string = process.cwd()): Promise<ConfigValues> {
    const valuesPath = resolve(cwd, `config/${env}.ts`);
    if (!existsSync(valuesPath)) {
        throw new Error(`Values file not found at ${valuesPath}`);
    }

    const imported = await import(valuesPath);
    return imported.values;
}
