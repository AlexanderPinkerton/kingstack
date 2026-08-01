import { createBoundLogger, type LogWriter } from "./core.js";
import type { AppLogger, LogContext, LogLevel } from "./types.js";

export interface CapturedLogRecord {
  readonly level: Exclude<LogLevel, "silent">;
  readonly event: string;
  readonly context: LogContext;
  readonly error?: unknown;
}

export interface CapturingLogger {
  readonly logger: AppLogger;
  readonly records: readonly CapturedLogRecord[];
  clear(): void;
}

export function createCapturingLogger(
  bindings: LogContext = {},
): CapturingLogger {
  const records: CapturedLogRecord[] = [];
  const writer: LogWriter = {
    write(level, event, context, error) {
      records.push({ level, event, context, error });
    },
    isLevelEnabled(level) {
      return level !== "silent";
    },
  };

  return {
    logger: createBoundLogger(writer, bindings),
    records,
    clear() {
      records.length = 0;
    },
  };
}

export function createNoopLogger(): AppLogger {
  const writer: LogWriter = {
    write() {},
    isLevelEnabled() {
      return false;
    },
  };
  return createBoundLogger(writer);
}

export type { AppLogger, LogContext, LogLevel } from "./types.js";
