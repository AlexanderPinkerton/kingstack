import { Module } from "@nestjs/common";
import { TodosController } from "./todos.controller";
import { PublicTodosController } from "./public-todos.controller";
import { TodosService } from "./todos.service";

@Module({
  controllers: [TodosController, PublicTodosController],
  providers: [TodosService],
  exports: [TodosService],
})
export class TodosModule {}
