import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { PostsModule } from "./posts/posts.module";
import { TodosModule } from "./todos/todos.module";
import { RealtimeModule } from "./realtime/realtime.module";

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(), // Used for scheduling tasks
    PostsModule, // Used to load environment variables globally
    TodosModule, // Todo CRUD operations
    RealtimeModule, // WebSocket realtime gateway
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
