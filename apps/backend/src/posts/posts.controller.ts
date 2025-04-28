import { Body, Controller, Get, Post, Request } from "@nestjs/common";

import { UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt.auth.guard";

// import the prisma client if
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
    const posts = await this.prisma.post.findMany();
    console.log("Fetched posts:", posts);
    // Return the posts
    return posts;
  }

  @Post()
  async createPost(@Request() req: any, @Body() body: any) {
    const userId = req.user.sub; // The user ID is in the 'sub' field of the JWT payload

    // req.user example
    // {
    //     iss: 'https://gswnatmjldebpgufckjt.supabase.co/auth/v1',
    //     sub: 'cf2ab0fc-2cf8-427f-92af-6a35dc6681e3',
    //     aud: 'authenticated',
    //     exp: 1745198669,
    //     iat: 1745195069,
    //     email: 'alexpinkerton88@gmail.com',
    //     phone: '',
    //     app_metadata: { provider: 'google', providers: [ 'google' ] },
    //     user_metadata: {
    //       avatar_url: 'https://lh3.googleusercontent.com/a/ACg8ocJXFTPr1PO9t6zXWzoAWMtIb7YUCDqgZ0yCKMDHQZsI05Y9vPag=s96-c',
    //       email: 'alexpinkerton88@gmail.com',
    //       email_verified: true,
    //       full_name: 'Alexander Pinkerton',
    //       iss: 'https://accounts.google.com',
    //       name: 'Alexander Pinkerton',
    //       phone_verified: false,
    //       picture: 'https://lh3.googleusercontent.com/a/ACg8ocJXFTPr1PO9t6zXWzoAWMtIb7YUCDqgZ0yCKMDHQZsI05Y9vPag=s96-c',
    //       provider_id: '117336688802687046371',
    //       sub: '117336688802687046371'
    //     },
    //     role: 'authenticated',
    //     aal: 'aal1',
    //     amr: [ { method: 'oauth', timestamp: 1745195069 } ],
    //     session_id: 'acb6701e-876f-495d-acd8-c096a202fbfa',
    //     is_anonymous: false
    //   }

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
