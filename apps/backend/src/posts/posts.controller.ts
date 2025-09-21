import { Body, Controller, Get, Post, Request } from "@nestjs/common";

import { UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt.auth.guard";

import { PrismaClient } from "@prisma/client";

@Controller("posts")
@UseGuards(JwtAuthGuard)
export class PostsController {
  private prisma: PrismaClient;
  constructor() {
    // Initialize the Prisma client here if needed
    this.prisma = new PrismaClient();
  }

  // Get posts from db
  @Get()
  async getPosts() {
    // Use the Prisma client to fetch posts from the database
    console.log("Fetching posts from the database...");
    const posts = await this.prisma.post.findMany({
      orderBy: {
        created_at: "desc",
      },
    });
    console.log("Fetched posts:", posts);
    // Return the posts
    return posts;
  }

  @Post()
  async createPost(@Request() req: any, @Body() body: any) {
    const userId = req.user.sub; // The user ID is in the 'sub' field of the JWT payload

    await this.prisma.post.create({
      data: {
        title: body.title || "Default Title",
        content: body.content || "Default Content",
        published: body.published || false,
        author_id: userId, // Assuming you have an author with ID 1
      },
    });

    return {
      message: "Post created successfully",
      // You can also return the created post data if needed
    };
  }
}
