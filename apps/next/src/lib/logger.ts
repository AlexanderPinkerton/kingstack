import "server-only";

import type { AppLogger, DeploymentEnvironment } from "@kingstack/logger";
import { createLazyLogger } from "@kingstack/logger";
import { createNodeLogger } from "@kingstack/logger/node";

export const serverLogger = createLazyLogger(
  () =>
    createNodeLogger({
      service: "next",
      environment: inferEnvironment(),
      level:
        process.env.LOG_LEVEL ??
        (process.env.NODE_ENV === "test" ? "silent" : undefined),
      format: process.env.LOG_FORMAT,
      production: process.env.NODE_ENV === "production",
      serverless: Boolean(process.env.VERCEL),
    }).logger,
);

export function createRequestLogger(
  request: Request,
  component: string,
): AppLogger {
  const requestId = request.headers.get("x-request-id") ?? "unavailable";
  const url = new URL(request.url);

  return serverLogger.child({
    component,
    requestId,
    method: request.method,
    path: url.pathname,
  });
}

function inferEnvironment(): DeploymentEnvironment {
  if (process.env.KINGSTACK_ENVIRONMENT) {
    return process.env.KINGSTACK_ENVIRONMENT as DeploymentEnvironment;
  }
  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.VERCEL_ENV) return "development";
  return process.env.NODE_ENV === "production" ? "production" : "local";
}
