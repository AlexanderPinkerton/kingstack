// The logger is constructed while AppModule imports are evaluated, before
// ConfigModule.forRoot() runs. Load the application env first so logging
// configuration participates in that initial construction.
import "dotenv/config";

import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  Global,
  Injectable,
  Module,
  type OnApplicationShutdown,
} from "@nestjs/common";
import type { AppLogger } from "@kingstack/logger";
import { createNodeLogger, createPinoAdapter } from "@kingstack/logger/node";
import { LoggerModule, PinoLogger } from "nestjs-pino";
import type { Options as PinoHttpOptions } from "pino-http";

export const APP_LOGGER = Symbol("APP_LOGGER");
export const REQUEST_ID_HEADER = "x-request-id";

const runtime = createNodeLogger({
  service: "nest",
  environment: process.env.KINGSTACK_ENVIRONMENT,
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "test" ? "silent" : undefined),
  format: process.env.LOG_FORMAT,
  production: process.env.NODE_ENV === "production",
  serverless: false,
});

export const bootstrapLogger = runtime.logger.child({ component: "Bootstrap" });

export async function flushLogs(): Promise<void> {
  await runtime.flush();
}

const pinoHttp: PinoHttpOptions = {
  logger: runtime.raw,
  quietReqLogger: true,
  customAttributeKeys: {
    reqId: "requestId",
  },
  genReqId(request, response) {
    const requestId = getOrCreateRequestId(request);
    response.setHeader(REQUEST_ID_HEADER, requestId);
    return requestId;
  },
  serializers: {
    req(request: IncomingMessage) {
      return {
        method: request.method,
        path: request.url?.split("?", 1)[0],
      };
    },
    res(response: ServerResponse) {
      return { statusCode: response.statusCode };
    },
  },
  autoLogging: {
    ignore: (request) => request.url?.split("?", 1)[0] === "/health",
  },
  customLogLevel(_request, response, error) {
    if (error || response.statusCode >= 500) return "error";
    if (response.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: () => "http.request.completed",
  customErrorMessage: () => "http.request.failed",
};

@Injectable()
class LoggerShutdown implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await flushLogs();
  }
}

@Global()
@Module({
  imports: [LoggerModule.forRoot({ pinoHttp })],
  providers: [
    {
      provide: APP_LOGGER,
      inject: [PinoLogger],
      useFactory: (pinoLogger: PinoLogger): AppLogger =>
        createPinoAdapter(() => pinoLogger.logger),
    },
    LoggerShutdown,
  ],
  exports: [APP_LOGGER, LoggerModule],
})
export class LoggingModule {}

export function getOrCreateRequestId(request: IncomingMessage): string {
  const requestWithId = request as IncomingMessage & { id?: unknown };
  if (isValidRequestId(requestWithId.id)) return requestWithId.id;

  const supplied = request.headers[REQUEST_ID_HEADER];
  const requestId = isValidRequestId(supplied) ? supplied : randomUUID();
  requestWithId.id = requestId;
  return requestId;
}

function isValidRequestId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9._:-]+$/.test(value)
  );
}
