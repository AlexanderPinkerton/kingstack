import type {
  AppLogger,
  ErrorLogDetails,
  LogContext,
  LogLevel,
} from "./types.js";

export interface LogWriter {
  write(
    level: Exclude<LogLevel, "silent">,
    event: string,
    context: LogContext,
    error?: unknown,
  ): void;
  isLevelEnabled(level: LogLevel): boolean;
}

export function createBoundLogger(
  writer: LogWriter,
  bindings: LogContext = {},
): AppLogger {
  const write = (
    level: Exclude<LogLevel, "silent">,
    event: string,
    context: LogContext = {},
    error?: unknown,
  ): void => {
    if (!writer.isLevelEnabled(level)) return;
    writer.write(level, event, { ...bindings, ...context }, error);
  };

  const writeError = (
    level: "error" | "fatal",
    event: string,
    details: ErrorLogDetails = {},
  ): void => {
    write(level, event, details.context, details.error);
  };

  return {
    trace: (event, context) => write("trace", event, context),
    debug: (event, context) => write("debug", event, context),
    info: (event, context) => write("info", event, context),
    warn: (event, context) => write("warn", event, context),
    error: (event, details) => writeError("error", event, details),
    fatal: (event, details) => writeError("fatal", event, details),
    child: (childBindings) =>
      createBoundLogger(writer, { ...bindings, ...childBindings }),
    isLevelEnabled: (level) => writer.isLevelEnabled(level),
  };
}
