import { type NextRequest } from "next/server";

import prisma from "@/lib/prisma";

import {
  authenticatePermanentBearerRequest,
  bearerAuthenticationErrorResponse,
} from "@/lib/auth/server-auth";
import { createRequestLogger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const logger = createRequestLogger(request, "UserRoute");
  const authentication = await authenticatePermanentBearerRequest(request);
  if (!authentication.ok) {
    return bearerAuthenticationErrorResponse(authentication);
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        id: authentication.userId,
      },
    });
    return Response.json(user, { status: 200 });
  } catch (error) {
    logger.error("user.fetch_failed", { error });
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
