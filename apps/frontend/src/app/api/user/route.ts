import { type NextRequest } from "next/server";

import prisma from "@/lib/prisma";

import { createClient } from "@/lib/supabase/serverClient";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const jwt = request.headers.get("Authorization")?.replace("Bearer ", "");
  const { data: userData } = await supabase.auth.getUser(jwt);

  if (!userData?.user?.id) {
    return Response.json("Unauthorized", { status: 401 });
  }

  try {
    // Extract User id from Supabase
    const userId = userData.user.id;
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    return Response.json(user, { status: 200 });
  } catch (error) {
    console.log(error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
