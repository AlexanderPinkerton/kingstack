import { Inject, Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { AppLogger } from "@kingstack/logger";

import { PrismaService } from "../prisma/prisma.service";
import { APP_LOGGER } from "../logging";

@Injectable()
export class PostsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_LOGGER) logger: AppLogger,
  ) {
    this.logger = logger.child({ component: PostsService.name });
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCron() {
    this.logger.debug("posts.cleanup_started");

    const result = await this.prisma.post.deleteMany({});
    this.logger.info("posts.cleanup_completed", { deletedCount: result.count });
  }
}
