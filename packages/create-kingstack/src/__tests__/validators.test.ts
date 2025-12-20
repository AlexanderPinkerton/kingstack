import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateProjectName, validateTools, checkDockerRunning } from "../validators";
import * as utils from "../utils";
import { spawnSync } from "child_process";

// Mock child_process
vi.mock("child_process", () => ({
    spawnSync: vi.fn(),
    execSync: vi.fn(),
    spawn: vi.fn(),
}));

describe("validateProjectName", () => {
    it("should return true for valid project names", () => {
        expect(validateProjectName("my-app")).toBe(true);
        expect(validateProjectName("myapp")).toBe(true);
        expect(validateProjectName("my-app-123")).toBe(true);
        expect(validateProjectName("app123")).toBe(true);
    });

    it("should reject empty names", () => {
        expect(validateProjectName("")).toBe("Project name is required");
    });

    it("should reject names starting with numbers", () => {
        expect(validateProjectName("123app")).toContain("must start with a letter");
    });

    it("should reject names with uppercase letters", () => {
        expect(validateProjectName("MyApp")).toContain("lowercase");
    });

    it("should reject names with special characters", () => {
        expect(validateProjectName("my_app")).toContain("lowercase");
        expect(validateProjectName("my.app")).toContain("lowercase");
        expect(validateProjectName("my@app")).toContain("lowercase");
    });

    it("should reject names that are too short", () => {
        expect(validateProjectName("a")).toBe("Project name must be at least 2 characters");
    });

    it("should reject names that are too long", () => {
        const longName = "a".repeat(51);
        expect(validateProjectName(longName)).toBe("Project name must be less than 50 characters");
    });
});

describe("validateTools", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock commandExists to return true by default
        vi.spyOn(utils, "commandExists").mockReturnValue(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should return success when all core tools are available", () => {
        const result = validateTools();
        expect(result.success).toBe(true);
        expect(result.canRunPlayground).toBe(true);
        expect(result.canRunFull).toBe(true);
        expect(result.missing).toHaveLength(0);
    });

    it("should report missing git", () => {
        vi.spyOn(utils, "commandExists").mockImplementation((cmd) => cmd !== "git");
        const result = validateTools();
        expect(result.success).toBe(false);
        expect(result.canRunPlayground).toBe(false);
        expect(result.missing.some(m => m.includes("git"))).toBe(true);
    });

    it("should report missing bun", () => {
        vi.spyOn(utils, "commandExists").mockImplementation((cmd) => cmd !== "bun");
        const result = validateTools();
        expect(result.success).toBe(false);
        expect(result.canRunPlayground).toBe(false);
        expect(result.missing.some(m => m.includes("bun"))).toBe(true);
    });

    it("should allow playground but not full when docker is missing", () => {
        vi.spyOn(utils, "commandExists").mockImplementation((cmd) => cmd !== "docker");
        const result = validateTools();
        expect(result.success).toBe(true);
        expect(result.canRunPlayground).toBe(true);
        expect(result.canRunFull).toBe(false);
    });
});

describe("checkDockerRunning", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return true when docker info succeeds", () => {
        vi.mocked(spawnSync).mockReturnValue({ status: 0 } as ReturnType<typeof spawnSync>);
        expect(checkDockerRunning()).toBe(true);
    });

    it("should return false when docker info fails", () => {
        vi.mocked(spawnSync).mockReturnValue({ status: 1 } as ReturnType<typeof spawnSync>);
        expect(checkDockerRunning()).toBe(false);
    });

    it("should return false when docker command throws", () => {
        vi.mocked(spawnSync).mockImplementation(() => {
            throw new Error("Command not found");
        });
        expect(checkDockerRunning()).toBe(false);
    });
});
