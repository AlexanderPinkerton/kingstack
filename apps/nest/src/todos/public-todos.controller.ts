import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

export interface CreatePublicTodoDto {
  title: string;
}

export interface UpdatePublicTodoDto {
  title?: string;
  done?: boolean;
}

@Controller("public/todos")
export class PublicTodosController {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  @Get()
  async getTodos() {
    // Get all public todos (no user filtering)
    const todos = await this.prisma.todo.findMany({
      where: {
        // In a real app, you might want to filter by a "public" flag
        // For now, we'll just return all todos as a demo
        // This is fine for a demo/landing page
      },
      orderBy: {
        created_at: "desc",
      },
      take: 50, // Limit to 50 for demo
    });
    return todos;
  }

  @Post()
  async createTodo(@Body() createTodoDto: CreatePublicTodoDto) {
    // Ensure public demo user exists, create if it doesn't
    const demoUserEmail = "public-demo@kingstack.dev";
    const demoUsername = "public-demo-user";

    let demoUser = await this.prisma.user.findUnique({
      where: { email: demoUserEmail },
    });

    if (!demoUser) {
      // Create the public demo user if it doesn't exist
      demoUser = await this.prisma.user.create({
        data: {
          id: "public-demo-user",
          email: demoUserEmail,
          username: demoUsername,
        },
      });
    }

    const todo = await this.prisma.todo.create({
      data: {
        title: createTodoDto.title,
        user_id: demoUser.id,
      },
    });
    return todo;
  }

  @Put(":id")
  async updateTodo(
    @Param("id") id: string,
    @Body() updateTodoDto: UpdatePublicTodoDto,
  ) {
    const todo = await this.prisma.todo.update({
      where: {
        id: id,
      },
      data: updateTodoDto,
    });
    return todo;
  }

  @Delete(":id")
  async deleteTodo(@Param("id") id: string) {
    await this.prisma.todo.delete({
      where: {
        id: id,
      },
    });
    return { id };
  }
}
