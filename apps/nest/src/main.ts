import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";

async function bootstrap() {
  const adapter = new FastifyAdapter({
    bodyLimit: 1048576, // 1MB
  });

  // Enable rawBody for Stripe webhook signature verification
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    {
      rawBody: true,
    },
  );

  // Hybrid CORS configuration:
  // - Production: Strict CORS (only production frontend URL)
  // - Dev/Staging: Flexible CORS (Vercel previews + local dev)
  const isProduction = process.env.NODE_ENV === "production";
  const frontendUrl = process.env.NEXT_URL; // e.g., http://localhost:3069 or https://yourdomain.com

  console.log(
    `🔒 CORS mode: ${isProduction ? "production (strict)" : "dev/staging (flexible)"}`,
  );
  console.log(`   Frontend URL: ${frontendUrl}`);

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

  console.log("Starting server on port", process.env.PORT ?? 3000);

  await app.listen(process.env.PORT ?? 3000, "0.0.0.0");
}

bootstrap();
