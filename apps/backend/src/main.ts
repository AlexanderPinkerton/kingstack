import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // Enable CORS for the frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || "http://localhost:3069",
    credentials: true,
  });

  // Set global prefix for API routes
  // app.setGlobalPrefix('api');

  // Bind this port to all available network interfaces, not just localhost.
  // Kingtip: Inside Docker or any containerized environment: always use '0.0.0.0' instead of 'localhost'

  console.log("Starting server on port", process.env.PORT ?? 3000);

  await app.listen(process.env.PORT ?? 3000, "0.0.0.0");
}

bootstrap();
