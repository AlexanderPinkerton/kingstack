import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { CreateTodoDto, UpdateTodoDto } from "./todos.controller";

@Injectable()
export class TodosService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async findAll(userId: string) {
    console.log("Fetching todos for user:", userId);
    const todos = await this.prisma.todo.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        created_at: "desc",
      },
    });
    console.log("Fetched todos:", todos);
    return todos;
  }

  async create(userId: string, createTodoDto: CreateTodoDto) {
    console.log("Creating todo for user:", userId, createTodoDto);
    const todo = await this.prisma.todo.create({
      data: {
        title: createTodoDto.title,
        user_id: userId,
      },
    });
    console.log("Created todo:", todo);
    return todo;
  }

  async update(userId: string, id: string, updateTodoDto: UpdateTodoDto) {
    console.log("Updating todo:", id, "for user:", userId, updateTodoDto);
    
    // First, check if the todo exists and belongs to the user
    const existingTodo = await this.prisma.todo.findFirst({
      where: {
        id: id,
        user_id: userId,
      },
    });

    if (!existingTodo) {
      throw new NotFoundException("Todo not found or you don't have permission to update it");
    }

    const todo = await this.prisma.todo.update({
      where: {
        id: id,
      },
      data: updateTodoDto,
    });
    
    console.log("Updated todo:", todo);
    return todo;
  }

  async remove(userId: string, id: string) {
    console.log("Deleting todo:", id, "for user:", userId);
    
    // First, check if the todo exists and belongs to the user
    const existingTodo = await this.prisma.todo.findFirst({
      where: {
        id: id,
        user_id: userId,
      },
    });

    if (!existingTodo) {
      throw new NotFoundException("Todo not found or you don't have permission to delete it");
    }

    await this.prisma.todo.delete({
      where: {
        id: id,
      },
    });
    
    console.log("Deleted todo:", id);
  }
}
