import { Module } from "@nestjs/common";
import { PublicTodosController } from "./public-todos.controller";

@Module({
  controllers: [PublicTodosController],
  providers: [],
  exports: [],
})
export class TodosModule {}
