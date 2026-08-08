import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PublicTodosController } from "./public-todos.controller";

@Module({
  imports: [AuthModule],
  controllers: [PublicTodosController],
  providers: [],
  exports: [],
})
export class TodosModule {}
