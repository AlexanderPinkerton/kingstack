import { type NextRequest } from "next/server";
import { checkAdminStatus } from "@/lib/admin-utils";
import { createRequestLogger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const logger = createRequestLogger(request, "AdminCheckRoute");
  const adminCheck = await checkAdminStatus(request, logger);

  if (!adminCheck.isAdmin) {
    return Response.json(
      { isAdmin: false, error: adminCheck.error },
      { status: adminCheck.status },
    );
  }

  return Response.json({ isAdmin: true, userEmail: adminCheck.userEmail });
}
