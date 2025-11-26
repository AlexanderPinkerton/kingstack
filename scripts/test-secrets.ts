/**
 * test-secrets.ts
 * 
 * Tests the secrets system to ensure validation and computed values work correctly.
 * 
 * Usage:
 *   bun scripts/test-secrets.ts
 */

import { defineSchema, resolveSecrets, validateProjectKeys } from "../secrets/utils";

// Create a minimal test schema
const testSchema = defineSchema({
    core: {
        BASE_URL: { required: true, description: "Base URL" },
        PORT: { default: "3000", description: "Port number" },
        API_KEY: { required: true, description: "API key" },
    },
    computed: (core) => ({
        FULL_URL: `${core.BASE_URL}:${core.PORT}`,
        PUBLIC_URL: core.BASE_URL,
    }),
    projects: {
        app: {
            path: "test/.env",
            keys: ["FULL_URL", "PUBLIC_URL", "API_KEY"],
        },
    },
});

function runTests() {
    console.log("🧪 Running secrets system tests...\n");

    let passed = 0;
    let failed = 0;

    // Test 1: Valid values
    console.log("Test 1: Valid values with defaults");
    {
        const values = {
            BASE_URL: "http://localhost",
            API_KEY: "test-key",
        };
        const { secrets, errors } = resolveSecrets(testSchema, values);

        if (errors.length === 0 &&
            secrets.core.PORT === "3000" &&
            secrets.computed.FULL_URL === "http://localhost:3000") {
            console.log("  ✅ PASSED\n");
            passed++;
        } else {
            console.log("  ❌ FAILED:", errors);
            failed++;
        }
    }

    // Test 2: Missing required value
    console.log("Test 2: Missing required value");
    {
        const values = {
            BASE_URL: "http://localhost",
        };
        const { errors } = resolveSecrets(testSchema, values);

        if (errors.length > 0 && errors[0].key === "API_KEY") {
            console.log("  ✅ PASSED\n");
            passed++;
        } else {
            console.log("  ❌ FAILED: Should have validation error for API_KEY\n");
            failed++;
        }
    }

    // Test 3: Computed values
    console.log("Test 3: Computed values");
    {
        const values = {
            BASE_URL: "https://example.com",
            PORT: "8080",
            API_KEY: "secret",
        };
        const { secrets, errors } = resolveSecrets(testSchema, values);

        if (errors.length === 0 &&
            secrets.computed.FULL_URL === "https://example.com:8080" &&
            secrets.computed.PUBLIC_URL === "https://example.com") {
            console.log("  ✅ PASSED\n");
            passed++;
        } else {
            console.log("  ❌ FAILED:", secrets.computed);
            failed++;
        }
    }

    // Test 4: Project key validation
    console.log("Test 4: Project key validation");
    {
        const allKeys = new Set(["FULL_URL", "PUBLIC_URL", "API_KEY", "BASE_URL", "PORT"]);
        const errors = validateProjectKeys(testSchema, allKeys);

        if (errors.length === 0) {
            console.log("  ✅ PASSED\n");
            passed++;
        } else {
            console.log("  ❌ FAILED:", errors);
            failed++;
        }
    }

    // Test 5: Invalid project key
    console.log("Test 5: Invalid project key detection");
    {
        const invalidSchema = defineSchema({
            ...testSchema,
            projects: {
                app: {
                    path: "test/.env",
                    keys: ["NONEXISTENT_KEY"],
                },
            },
        });
        const allKeys = new Set(["FULL_URL", "PUBLIC_URL"]);
        const errors = validateProjectKeys(invalidSchema, allKeys);

        if (errors.length > 0) {
            console.log("  ✅ PASSED\n");
            passed++;
        } else {
            console.log("  ❌ FAILED: Should detect invalid key\n");
            failed++;
        }
    }

    // Summary
    console.log("─".repeat(50));
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
        console.log("✅ All tests passed!\n");
        process.exit(0);
    } else {
        console.log("❌ Some tests failed\n");
        process.exit(1);
    }
}

runTests();
