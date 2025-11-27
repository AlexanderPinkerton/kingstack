import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Request,
  Param,
} from "@nestjs/common";

import { UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt.auth.guard";

import { PrismaService } from "../prisma/prisma.service";

@Controller("posts")
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly prisma: PrismaService) {}

  // Get posts from db with author info
  @Get()
  async getPosts() {
    // Use the Prisma client to fetch posts from the database
    console.log("Fetching posts from the database...");
    const posts = await this.prisma.post.findMany({
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });
    // Return the posts
    return posts;
  }

  @Post()
  async createPost(@Request() req: any, @Body() body: any) {
    const userId = req.user.sub; // The user ID is in the 'sub' field of the JWT payload

    const post = await this.prisma.post.create({
      data: {
        title: body.title || "Default Title",
        content: body.content || "Default Content",
        published: body.published || false,
        author_id: userId,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    return post;
  }

  @Put(":id")
  async updatePost(
    @Param("id") id: string,
    @Request() req: any,
    @Body() body: any,
  ) {
    const userId = req.user.sub;

    // Verify the post belongs to the user
    const existingPost = await this.prisma.post.findFirst({
      where: { id, author_id: userId },
    });

    if (!existingPost) {
      throw new Error("Post not found or not authorized");
    }

    const post = await this.prisma.post.update({
      where: { id },
      data: {
        title: body.title,
        content: body.content,
        published: body.published,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    return post;
  }

  @Delete(":id")
  async deletePost(@Param("id") id: string, @Request() req: any) {
    const userId = req.user.sub;

    // Verify the post belongs to the user
    const existingPost = await this.prisma.post.findFirst({
      where: { id, author_id: userId },
    });

    if (!existingPost) {
      throw new Error("Post not found or not authorized");
    }

    await this.prisma.post.delete({
      where: { id },
    });

    return { id, message: "Post deleted successfully" };
  }
}
