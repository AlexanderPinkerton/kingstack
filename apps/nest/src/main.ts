import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger as NestPinoLogger } from "nestjs-pino";
import {
  bootstrapLogger,
  flushLogs,
  getOrCreateRequestId,
  REQUEST_ID_HEADER,
} from "./logging";

import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import type {
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction,
} from "fastify";

async function bootstrap() {
  const adapter = new FastifyAdapter({
    bodyLimit: 1048576, // 1MB
    requestIdHeader: REQUEST_ID_HEADER,
    genReqId: getOrCreateRequestId,
  });
  adapter
    .getInstance()
    .addHook(
      "onRequest",
      (
        request: FastifyRequest,
        reply: FastifyReply,
        done: HookHandlerDoneFunction,
      ) => {
        reply.header(REQUEST_ID_HEADER, request.id);
        done();
      },
    );

  // Enable rawBody for Stripe webhook signature verification
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    {
      rawBody: true,
      bufferLogs: true,
    },
  );

  app.useLogger(app.get(NestPinoLogger));

  // Hybrid CORS configuration:
  // - Production: Strict CORS (only production frontend URL)
  // - Dev/Staging: Flexible CORS (Vercel previews + local dev)
  const isProduction = process.env.NODE_ENV === "production";
  const frontendUrl = process.env.NEXT_URL; // e.g., http://localhost:3069 or https://yourdomain.com

  bootstrapLogger.info("cors.configured", {
    mode: isProduction ? "strict" : "flexible",
    frontendUrl,
  });

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) {
        return callback(null, true);
      }

      // Production: Only allow configured frontend URL
      if (isProduction) {
        if (origin === frontendUrl) {
          return callback(null, true);
        }
        return callback(null, false);
      }

      // Dev/Staging: Allow configured URL, Vercel previews, and localhost
      const allowedPatterns: (string | RegExp | undefined)[] = [
        frontendUrl, // Configured frontend URL
        /\.vercel\.app$/, // All Vercel preview deployments
        /^http:\/\/localhost:\d+$/, // Any localhost port for local dev
      ];

      const isAllowed = allowedPatterns.some((pattern) => {
        if (!pattern) return false;
        if (typeof pattern === "string") {
          return origin === pattern;
        }
        return pattern.test(origin);
      });

      if (isAllowed) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Set global prefix for API routes
  // app.setGlobalPrefix('api');

  // Bind this port to all available network interfaces, not just localhost.
  // Kingtip: Inside Docker or any containerized environment: always use '0.0.0.0' instead of 'localhost'

  const port = process.env.PORT ?? 3000;
  bootstrapLogger.info("server.starting", { port });

  await app.listen(port, "0.0.0.0");
  bootstrapLogger.info("server.started", { port });
}

void bootstrap().catch(async (error: unknown) => {
  bootstrapLogger.fatal("server.start_failed", { error });
  await flushLogs();
  process.exitCode = 1;
});
