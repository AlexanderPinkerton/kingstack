export const LOG_LEVELS = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
  "silent",
] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];
export type DeploymentEnvironment = "local" | "development" | "production";
export type LogScalar = string | number | boolean | null | undefined;
export type LogValue = LogScalar | readonly LogScalar[];
export type LogContext = Readonly<Record<string, LogValue>>;

export interface ErrorLogDetails {
  readonly context?: LogContext;
  readonly error?: unknown;
}

export interface AppLogger {
  trace(event: string, context?: LogContext): void;
  debug(event: string, context?: LogContext): void;
  info(event: string, context?: LogContext): void;
  warn(event: string, context?: LogContext): void;
  error(event: string, details?: ErrorLogDetails): void;
  fatal(event: string, details?: ErrorLogDetails): void;
  child(bindings: LogContext): AppLogger;
  isLevelEnabled(level: LogLevel): boolean;
}

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === "string" && LOG_LEVELS.includes(value as LogLevel);
}

export function createLazyLogger(factory: () => AppLogger): AppLogger {
  let root: AppLogger | undefined;

  const getRoot = (): AppLogger => {
    root ??= factory();
    return root;
  };

  return createLazyChild(getRoot, {});
}

function createLazyChild(
  getRoot: () => AppLogger,
  bindings: LogContext,
): AppLogger {
  let resolved: AppLogger | undefined;

  const getLogger = (): AppLogger => {
    if (!resolved) {
      const root = getRoot();
      resolved = Object.keys(bindings).length > 0 ? root.child(bindings) : root;
    }
    return resolved;
  };

  return {
    trace(event, context) {
      getLogger().trace(event, context);
    },
    debug(event, context) {
      getLogger().debug(event, context);
    },
    info(event, context) {
      getLogger().info(event, context);
    },
    warn(event, context) {
      getLogger().warn(event, context);
    },
    error(event, details) {
      getLogger().error(event, details);
    },
    fatal(event, details) {
      getLogger().fatal(event, details);
    },
    child(childBindings) {
      return createLazyChild(getRoot, { ...bindings, ...childBindings });
    },
    isLevelEnabled(level) {
      return getLogger().isLevelEnabled(level);
    },
  };
}
