import { createClient } from "@/lib/supabase/serverClient";
import prisma from "@/lib/prisma";

export interface UserAuthDetails {
  isAuthenticated: boolean;
  userId?: string;
  userEmail?: string;
  isAdmin?: boolean;
  error?: string;
}

/**
 * Gets comprehensive user authentication details including admin status
 * @param jwt - JWT token from Authorization header
 * @returns Promise<UserAuthDetails>
 */
export async function getUserAuthDetails(
  jwt: string | null,
): Promise<UserAuthDetails> {
  try {
    if (!jwt) {
      return {
        isAuthenticated: false,
        error: "No JWT token provided",
      };
    }

    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser(jwt);

    if (!userData?.user?.id || !userData.user?.email) {
      return {
        isAuthenticated: false,
        error: "Invalid user data",
      };
    }

    // Check if user email exists in admin_emails table
    // Verify prisma client has the admin_emails model
    if (!prisma.admin_emails) {
      console.error(
        "Prisma client does not have admin_emails model. Please regenerate Prisma client.",
      );
      return {
        isAuthenticated: true,
        userId: userData.user.id,
        userEmail: userData.user.email,
        isAdmin: false,
        error: "Prisma client not properly initialized",
      };
    }

    const adminRecord = await prisma.admin_emails.findUnique({
      where: { email: userData.user.email },
      select: { id: true, email: true },
    });

    return {
      isAuthenticated: true,
      userId: userData.user.id,
      userEmail: userData.user.email,
      isAdmin: !!adminRecord,
    };
  } catch (error) {
    console.error("Error getting user auth details:", error);
    return {
      isAuthenticated: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Convenience wrapper for admin routes that require admin access
 * @param jwt - JWT token from Authorization header
 * @returns Promise<{ isAdmin: boolean; userEmail?: string; error?: string }>
 */
export async function checkAdminStatus(jwt: string | null) {
  const authDetails = await getUserAuthDetails(jwt);

  if (!authDetails.isAuthenticated) {
    return {
      isAdmin: false,
      error: authDetails.error || "Not authenticated",
    };
  }

  return {
    isAdmin: authDetails.isAdmin || false,
    userEmail: authDetails.userEmail,
    error: authDetails.isAdmin ? undefined : "Not an admin",
  };
}
