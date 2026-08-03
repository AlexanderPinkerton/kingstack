import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import type { AppLogger } from "@kingstack/logger";
import { PrismaClient } from "@prisma/client";
import { APP_LOGGER } from "../logging";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger: AppLogger;

  constructor(@Inject(APP_LOGGER) logger: AppLogger) {
    super();
    this.logger = logger.child({ component: PrismaService.name });
  }

  async onModuleInit() {
    if (process.env.PRISMA_CONNECT_ON_START === "false") {
      this.logger.warn("prisma.startup_connection_skipped", {
        databaseBackedEndpointsAvailable: false,
      });
      return;
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks(_app: any) {
    // Shutdown hooks are handled by OnModuleDestroy
  }
}
