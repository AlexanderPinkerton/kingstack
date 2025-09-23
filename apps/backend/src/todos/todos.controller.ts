import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Request,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt.auth.guard";
import { TodosService } from "./todos.service";

export interface CreateTodoDto {
  title: string;
}

export interface UpdateTodoDto {
  title?: string;
  done?: boolean;
}

@Controller("todos")
@UseGuards(JwtAuthGuard)
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Get()
  async getTodos(@Request() req: any) {
    const userId = req.user.sub;
    return this.todosService.findAll(userId);
  }

  @Post()
  async createTodo(@Request() req: any, @Body() createTodoDto: CreateTodoDto) {
    const userId = req.user.sub;
    return this.todosService.create(userId, createTodoDto);
  }

  @Put(":id")
  async updateTodo(
    @Request() req: any,
    @Param("id") id: string,
    @Body() updateTodoDto: UpdateTodoDto,
  ) {
    const userId = req.user.sub;
    return this.todosService.update(userId, id, updateTodoDto);
  }

  @Delete(":id")
  async deleteTodo(@Request() req: any, @Param("id") id: string) {
    const userId = req.user.sub;
    await this.todosService.remove(userId, id);
    return { id };
  }
}
