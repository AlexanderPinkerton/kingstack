import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaClient } from '@prisma/client';

@Injectable()
export class PostsService {

    private readonly logger = new Logger(PostsService.name);
    private prisma: PrismaClient;

    @Cron(CronExpression.EVERY_30_MINUTES)
    async handleCron() {
        this.logger.debug('Called when the current second is 45');

        this.prisma = new PrismaClient();
        await this.prisma.post.deleteMany({});
        this.logger.debug('Deleted all posts from the database');
        this.prisma.$disconnect()

    }

}
