import prisma from "@/lib/prisma";
import { serverLogger } from "@/lib/logger";
import type { AppLogger } from "@kingstack/logger";
import {
  authenticateBearerRequest,
  type RequestWithHeaders,
} from "@/lib/auth/server-auth";

const logger = serverLogger.child({ component: "AdminUtils" });

export async function checkAdminStatus(
  request: RequestWithHeaders,
  requestLogger: AppLogger = logger,
): Promise<
  | { isAdmin: true; userEmail: string }
  | { error: string; isAdmin: false; status: 401 | 403 | 500 }
> {
  const authentication = await authenticateBearerRequest(request);
  if (!authentication.ok) {
    return {
      error: authentication.error,
      isAdmin: false,
      status: authentication.status,
    };
  }

  if (!authentication.email) {
    return {
      error: "Authenticated user has no email claim",
      isAdmin: false,
      status: 403,
    };
  }

  try {
    const adminRecord = await prisma.admin_emails.findUnique({
      where: { email: authentication.email },
      select: { id: true },
    });

    if (!adminRecord) {
      return { error: "Admin access required", isAdmin: false, status: 403 };
    }

    return {
      isAdmin: true,
      userEmail: authentication.email,
    };
  } catch (error) {
    requestLogger.error("admin.status_check_failed", { error });
    return {
      error: "Admin status could not be checked",
      isAdmin: false,
      status: 500,
    };
  }
}
