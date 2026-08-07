import { Writable } from "node:stream";
import pinoPretty from "pino-pretty";
import { describe, expect, it, vi } from "vitest";
import { createBrowserLogger } from "../src/browser";
import { DEFAULT_PRETTY_OPTIONS, createNodeLogger } from "../src/node";
import { createCapturingLogger, createNoopLogger } from "../src/testing";
import { createLazyLogger } from "../src/types";

function createLogDestination(): {
  destination: Writable;
  records: Array<Record<string, unknown>>;
} {
  const records: Array<Record<string, unknown>> = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      records.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      callback();
    },
  });
  return { destination, records };
}

describe("node logger", () => {
  it("writes structured events with inherited child context", () => {
    const { destination, records } = createLogDestination();
    const runtime = createNodeLogger({
      service: "test",
      environment: "local",
      level: "debug",
      destination,
    });

    runtime.logger.child({ component: "Example" }).info("example.completed", {
      count: 2,
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      service: "test",
      environment: "local",
      level: 30,
      event: "example.completed",
      component: "Example",
      count: 2,
    });
    expect(typeof records[0].time).toBe("number");
  });

  it("formats routine pretty logs as compact single-line records", () => {
    const format = pinoPretty.prettyFactory({
      ...DEFAULT_PRETTY_OPTIONS,
      colorize: false,
      translateTime: false,
    });

    const output = format({
      level: 30,
      service: "nest",
      environment: "local",
      component: "Bootstrap",
      event: "cors.configured",
      mode: "flexible",
    });

    expect(output.trim()).toBe(
      'INFO: [Bootstrap] cors.configured {"mode":"flexible"}',
    );
    expect(output.trim().split("\n")).toHaveLength(1);
  });

  it("serializes errors and redacts common secret fields", () => {
    const { destination, records } = createLogDestination();
    const runtime = createNodeLogger({
      service: "test",
      environment: "local",
      destination,
    });
    const error = Object.assign(
      new Error("database unavailable", { cause: new Error("socket closed") }),
      {
        token: "nested-secret",
        request: { headers: { authorization: "Bearer hidden" } },
      },
    );

    runtime.logger.error("database.query_failed", {
      context: { token: "do-not-log", operation: "find-user" },
      error,
    });

    expect(records[0]).toMatchObject({
      event: "database.query_failed",
      token: "[Redacted]",
      operation: "find-user",
      err: {
        type: "Error",
        message: "database unavailable",
        cause: {
          type: "Error",
          message: "socket closed",
        },
      },
    });
    expect(records[0].err).not.toHaveProperty("token");
    expect(records[0].err).not.toHaveProperty("request");
  });

  it("rejects invalid configuration and remote pretty output", () => {
    expect(() =>
      createNodeLogger({ service: "test", level: "verbose" }),
    ).toThrow("Invalid LOG_LEVEL");
    expect(() => createNodeLogger({ service: "test", format: "yaml" })).toThrow(
      "Invalid LOG_FORMAT",
    );
    expect(() =>
      createNodeLogger({
        service: "test",
        environment: "production",
        format: "pretty",
      }),
    ).toThrow("only supported by a local");
  });

  it("filters disabled levels before writing", () => {
    const { destination, records } = createLogDestination();
    const runtime = createNodeLogger({
      service: "test",
      level: "warn",
      destination,
    });

    expect(runtime.logger.isLevelEnabled("info")).toBe(false);
    expect(runtime.logger.isLevelEnabled("error")).toBe(true);
    runtime.logger.info("hidden");
    runtime.logger.warn("visible");

    expect(records.map((record) => record.event)).toEqual(["visible"]);
  });

  it("normalizes non-Error throws and writes fatal at the Pino fatal level", () => {
    const { destination, records } = createLogDestination();
    const runtime = createNodeLogger({ service: "test", destination });

    runtime.logger.error("non_error.failed", { error: "boom" });
    runtime.logger.fatal("process.terminating");

    expect(records[0]).toMatchObject({
      level: 50,
      event: "non_error.failed",
      err: { type: "NonErrorThrown", message: "boom" },
    });
    expect(records[1]).toMatchObject({
      level: 60,
      event: "process.terminating",
    });
  });

  it("keeps the payload of a rejected plain object", () => {
    const { destination, records } = createLogDestination();
    const runtime = createNodeLogger({ service: "test", destination });

    // Shape of a Supabase PostgrestError, which is not an Error instance.
    runtime.logger.error("query.failed", {
      error: {
        message: 'relation "post" does not exist',
        details: null,
        hint: null,
        code: "42P01",
      },
    });

    expect(records[0]).toMatchObject({
      event: "query.failed",
      err: {
        type: "NonErrorThrown",
        message: 'relation "post" does not exist',
        payload: { code: "42P01" },
      },
    });
  });

  it("falls back to a generic message for an object with no message", () => {
    const { destination, records } = createLogDestination();
    const runtime = createNodeLogger({ service: "test", destination });

    runtime.logger.error("query.failed", { error: { status: 503 } });

    expect(records[0]).toMatchObject({
      err: {
        type: "NonErrorThrown",
        message: "A non-Error value was thrown",
        payload: { status: 503 },
      },
    });
  });
});

describe("runtime-neutral adapters", () => {
  it("captures records and preserves child bindings", () => {
    const capture = createCapturingLogger({ service: "test" });
    capture.logger.child({ component: "Worker" }).warn("worker.delayed", {
      durationMs: 50,
    });

    expect(capture.records).toEqual([
      {
        level: "warn",
        event: "worker.delayed",
        context: {
          service: "test",
          component: "Worker",
          durationMs: 50,
        },
        error: undefined,
      },
    ]);
  });

  it("keeps a noop logger fully disabled", () => {
    const logger = createNoopLogger();
    expect(logger.isLevelEnabled("fatal")).toBe(false);
    expect(() => logger.fatal("ignored")).not.toThrow();
  });

  it("does not initialize a lazy logger until first use", () => {
    const factory = vi.fn(() => createCapturingLogger().logger);
    const logger = createLazyLogger(factory).child({ component: "Lazy" });

    expect(factory).not.toHaveBeenCalled();
    logger.info("lazy.initialized");
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("routes browser levels through controlled console methods", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createBrowserLogger({ level: "warn" });

    logger.info("hidden");
    logger.error("visible", { error: new Error("boom") });

    expect(info).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
  });
});
