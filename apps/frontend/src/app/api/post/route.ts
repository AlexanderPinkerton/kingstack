import { type NextRequest } from "next/server";

import { PrismaClient } from "@prisma/client";

import { createClient } from "@/lib/supabase/serverClient";

const prisma: PrismaClient = new PrismaClient();

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Get the session JWT token from the request headers
  const jwt = request.headers.get("Authorization")?.replace("Bearer ", "");

  const user = await supabase.auth.getUser(jwt);

  if (!user.data.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("USER:", user);

  try {
    const posts = await prisma.post.findMany();

    return Response.json(posts, { status: 200 });
  } catch (error) {
    console.log(error);

    return Response.json({ error }, { status: 500 });
  }
}
