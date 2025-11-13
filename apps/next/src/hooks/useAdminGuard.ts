import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RootStoreContext } from "@/context/rootStoreContext";
import { isPlaygroundMode } from "@kingstack/shared";
import { fetchWithAuth } from "@/lib/utils";

export interface UseAdminGuardOptions {
  /**
   * Backend to use for admin check
   * - "next": Use Next.js API route (/api/admin/check) - default
   * - "nest": Use NestJS API route (/admin/check)
   */
  backend?: "next" | "nest";
}

export default function useAdminGuard(options?: UseAdminGuardOptions) {
  const { backend = "next" } = options || {};
  const rootStore = useContext(RootStoreContext);
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      // Skip admin guard in playground mode
      if (isPlaygroundMode()) {
        setIsAdmin(true);
        setIsChecking(false);
        return;
      }

      // First check if user is authenticated
      if (!rootStore.session?.access_token) {
        setIsChecking(false);
        router.replace("/login");
        return;
      }

      try {
        // Determine the API endpoint based on backend choice
        const apiUrl =
          backend === "nest"
            ? `${process.env.NEXT_PUBLIC_NEST_URL || "http://localhost:3000"}/admin/check`
            : "/api/admin/check";

        const response = await fetchWithAuth(
          rootStore.session.access_token,
          apiUrl,
        );

        if (!response.ok) {
          // Not an admin, redirect to home
          setIsChecking(false);
          router.replace("/home");
          return;
        }

        const data = await response.json();
        if (data.isAdmin) {
          setIsAdmin(true);
        } else {
          setIsChecking(false);
          router.replace("/home");
          return;
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsChecking(false);
        router.replace("/home");
        return;
      } finally {
        setIsChecking(false);
      }
    };

    checkAdmin();
  }, [rootStore.session, router]);

  return { isChecking, isAdmin };
}
