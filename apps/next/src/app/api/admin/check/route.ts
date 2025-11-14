import { type NextRequest } from "next/server";
import { checkAdminStatus } from "@/lib/admin-utils";

export async function GET(request: NextRequest) {
  const jwt = request.headers.get("Authorization")?.replace("Bearer ", "");

  const adminCheck = await checkAdminStatus(jwt ?? null);

  if (!adminCheck.isAdmin) {
    return Response.json(
      { isAdmin: false, error: adminCheck.error },
      { status: 403 },
    );
  }

  return Response.json({ isAdmin: true, userEmail: adminCheck.userEmail });
}
