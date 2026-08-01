import { type NextRequest } from "next/server";
import { checkAdminStatus } from "@/lib/admin-utils";
import { createRequestLogger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const logger = createRequestLogger(request, "AdminCheckRoute");
  const jwt = request.headers.get("Authorization")?.replace("Bearer ", "");

  const adminCheck = await checkAdminStatus(jwt ?? null, logger);

  if (!adminCheck.isAdmin) {
    return Response.json(
      { isAdmin: false, error: adminCheck.error },
      { status: 403 },
    );
  }

  return Response.json({ isAdmin: true, userEmail: adminCheck.userEmail });
}
