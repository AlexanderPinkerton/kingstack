import { createBoundLogger, type LogWriter } from "./core.js";
import {
  isLogLevel,
  type AppLogger,
  type LogContext,
  type LogLevel,
} from "./types.js";

const LEVEL_VALUES: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: Number.POSITIVE_INFINITY,
};

export interface BrowserLoggerOptions {
  readonly level?: LogLevel;
  readonly bindings?: LogContext;
}

export function createBrowserLogger(
  options: BrowserLoggerOptions = {},
): AppLogger {
  const minimumLevel = options.level ?? "warn";
  if (!isLogLevel(minimumLevel)) {
    throw new Error(`Invalid browser log level: ${String(minimumLevel)}`);
  }

  const writer: LogWriter = {
    write(level, event, context, error) {
      const args: unknown[] = [event];
      if (Object.keys(context).length > 0) args.push(context);
      if (error !== undefined) args.push(error);

      if (level === "fatal" || level === "error") {
        console.error(...args);
        return;
      }
      if (level === "warn") {
        console.warn(...args);
        return;
      }
      if (level === "info") {
        console.info(...args);
        return;
      }
      console.debug(...args);
    },
    isLevelEnabled(level) {
      if (level === "silent" || minimumLevel === "silent") return false;
      return LEVEL_VALUES[level] >= LEVEL_VALUES[minimumLevel];
    },
  };

  return createBoundLogger(writer, options.bindings);
}

export type { AppLogger, LogContext, LogLevel } from "./types.js";
