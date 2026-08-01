import pino, {
  type DestinationStream,
  type Logger as PinoLogger,
  type LoggerOptions,
} from "pino";
import { createBoundLogger, type LogWriter } from "./core.js";
import {
  isLogLevel,
  type AppLogger,
  type DeploymentEnvironment,
  type LogContext,
  type LogLevel,
} from "./types.js";

export type LogFormat = "json" | "pretty";

export const DEFAULT_REDACT_PATHS = [
  "authorization",
  "Authorization",
  "cookie",
  "Cookie",
  "password",
  "passwd",
  "secret",
  "token",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "apiKey",
  "api_key",
  "privateKey",
  "private_key",
  "headers.authorization",
  "headers.cookie",
  "req.headers.authorization",
  "req.headers.cookie",
  "request.headers.authorization",
  "request.headers.cookie",
] as const;

export interface NodeLoggerOptions {
  readonly service: string;
  readonly environment?: string;
  readonly level?: string;
  readonly format?: string;
  readonly production?: boolean;
  readonly serverless?: boolean;
  readonly base?: LogContext;
  readonly redactPaths?: readonly string[];
  readonly destination?: DestinationStream;
}

export interface NodeLoggerRuntime {
  readonly logger: AppLogger;
  readonly raw: PinoLogger;
  readonly level: LogLevel;
  readonly format: LogFormat;
  readonly environment: DeploymentEnvironment;
  flush(): Promise<void>;
}

export interface PinoLogTarget {
  trace(object: object, message?: string): void;
  debug(object: object, message?: string): void;
  info(object: object, message?: string): void;
  warn(object: object, message?: string): void;
  error(object: object, message?: string): void;
  fatal(object: object, message?: string): void;
  isLevelEnabled(level: string): boolean;
}

export function createNodeLogger(
  options: NodeLoggerOptions,
): NodeLoggerRuntime {
  const level = parseLevel(options.level);
  const environment = parseEnvironment(options.environment, options.production);
  const format = parseFormat(options.format);

  if (format === "pretty" && (options.serverless || environment !== "local")) {
    throw new Error(
      "LOG_FORMAT=pretty is only supported by a local, non-serverless runtime.",
    );
  }

  if (format === "pretty" && options.destination) {
    throw new Error(
      "A pretty transport and custom destination cannot be combined.",
    );
  }

  const pinoOptions: LoggerOptions = {
    level,
    messageKey: "event",
    base: {
      ...options.base,
      service: options.service,
      environment,
    },
    redact: {
      paths: [...DEFAULT_REDACT_PATHS, ...(options.redactPaths ?? [])],
      censor: "[Redacted]",
    },
    serializers: {
      err: serializeError,
    },
  };

  if (format === "pretty") {
    pinoOptions.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname",
        messageKey: "event",
        translateTime: "SYS:standard",
      },
    };
  }

  const raw = options.destination
    ? pino(pinoOptions, options.destination)
    : pino(pinoOptions);

  return {
    logger: createPinoAdapter(() => raw),
    raw,
    level,
    format,
    environment,
    flush: () => flushPino(raw),
  };
}

export function createPinoAdapter(
  getTarget: () => PinoLogTarget,
  bindings: LogContext = {},
): AppLogger {
  const writer: LogWriter = {
    write(level, event, context, error) {
      const record: Record<string, unknown> = { ...context };
      if (error !== undefined) {
        record.err = normalizeError(error);
      }
      getTarget()[level](record, event);
    },
    isLevelEnabled(level) {
      if (level === "silent") return false;
      return getTarget().isLevelEnabled(level);
    },
  };

  return createBoundLogger(writer, bindings);
}

function parseLevel(value: string | undefined): LogLevel {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "info";
  if (isLogLevel(normalized)) return normalized;
  throw new Error(`Invalid LOG_LEVEL value: ${value}`);
}

function parseFormat(value: string | undefined): LogFormat {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "json";
  if (normalized === "json" || normalized === "pretty") return normalized;
  throw new Error(`Invalid LOG_FORMAT value: ${value}`);
}

function parseEnvironment(
  value: string | undefined,
  production = false,
): DeploymentEnvironment {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return production ? "production" : "local";
  if (
    normalized === "local" ||
    normalized === "development" ||
    normalized === "production"
  ) {
    return normalized;
  }
  throw new Error(`Invalid KINGSTACK_ENVIRONMENT value: ${value}`);
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;

  return new NonErrorThrown(
    typeof error === "string" ? error : "A non-Error value was thrown",
  );
}

function serializeError(value: unknown, depth = 0): Record<string, unknown> {
  const error = normalizeError(value);
  const serialized: Record<string, unknown> = {
    type: error.constructor.name || error.name,
    message: error.message,
  };

  if (error.stack) serialized.stack = error.stack;
  if (error.cause !== undefined && depth < 3) {
    serialized.cause = serializeError(error.cause, depth + 1);
  }

  return serialized;
}

class NonErrorThrown extends Error {
  override readonly name = "NonErrorThrown";
}

async function flushPino(logger: PinoLogger): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    // Pino transports unref their worker. Keep the process alive long enough
    // for the callback to arrive during an otherwise idle shutdown path.
    const timeout = setTimeout(() => {
      reject(new Error("Timed out while flushing logger output."));
    }, 5_000);

    logger.flush((error) => {
      clearTimeout(timeout);
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export type {
  AppLogger,
  DeploymentEnvironment,
  LogContext,
  LogLevel,
} from "./types.js";
