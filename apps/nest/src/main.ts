import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";

import { Logger } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // Configure CORS for the NextJS app to use this API
  app.enableCors({
    origin: process.env.NEXT_URL || "http://localhost:3069",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Set global prefix for API routes
  // app.setGlobalPrefix('api');

  // Bind this port to all available network interfaces, not just localhost.
  // Kingtip: Inside Docker or any containerized environment: always use '0.0.0.0' instead of 'localhost'

  const port = process.env.PORT || 3000;

  Logger.log(`Starting NEST server on port ${port}`);

  await app.listen(port, "0.0.0.0");
}

bootstrap();
