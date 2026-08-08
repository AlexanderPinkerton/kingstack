import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { comparer, reaction } from "mobx";
import { useRootStore } from "@/hooks/useRootStore";
import { fetchWithAuth } from "@/lib/auth/authenticated-fetch";
import { browserLogger } from "@/lib/browser-logger";

const logger = browserLogger.child({ component: "useAdminGuard" });

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
  const rootStore = useRootStore();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [auth, setAuth] = useState<{
    ready: boolean;
    token: string | null;
  }>({
    ready: false,
    token: null,
  });

  // Thin MobX-to-React adapter so callers do not need to be observer components.
  useEffect(
    () =>
      reaction(
        () => ({
          ready: rootStore.sessionReady,
          token: rootStore.session?.access_token ?? null,
        }),
        setAuth,
        { fireImmediately: true, equals: comparer.structural },
      ),
    [rootStore],
  );

  useEffect(() => {
    let isCancelled = false;

    const checkAdmin = async () => {
      if (!auth.ready) {
        setIsChecking(true);
        return;
      }

      if (!auth.token) {
        setIsChecking(false);
        router.replace("/login");
        return;
      }

      // Double-check cancellation before making API call
      if (isCancelled) return;

      try {
        // Determine the API endpoint based on backend choice
        const apiUrl =
          backend === "nest"
            ? `${process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000"}/admin/check`
            : "/api/admin/check";

        const response = await fetchWithAuth(auth.token, apiUrl);

        // Check cancellation after async operation
        if (isCancelled) return;

        if (!response.ok) {
          // Not an admin, redirect to the application
          setIsChecking(false);
          router.replace("/app");
          return;
        }

        const data = await response.json();
        if (isCancelled) return;

        if (data.isAdmin) {
          setIsAdmin(true);
        } else {
          setIsChecking(false);
          router.replace("/app");
          return;
        }
      } catch (error) {
        if (isCancelled) return;
        logger.error("admin.status_check_failed", { error });
        setIsChecking(false);
        router.replace("/app");
        return;
      } finally {
        if (!isCancelled) {
          setIsChecking(false);
        }
      }
    };

    void checkAdmin();

    // Cleanup function to cancel if component unmounts or dependencies change
    return () => {
      isCancelled = true;
    };
  }, [auth, router, backend]);

  return { isChecking, isAdmin };
}
