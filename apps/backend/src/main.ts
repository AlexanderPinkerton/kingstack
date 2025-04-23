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

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
