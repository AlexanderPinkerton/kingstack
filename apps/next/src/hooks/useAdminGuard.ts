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

  // Track session access token in state so effect re-runs when it changes
  // The component using this hook should be wrapped in observer() for reactivity
  const [sessionToken, setSessionToken] = useState<string | null>(
    rootStore.session?.access_token || null,
  );

  // Update session token when rootStore.session changes
  // This effect will run when the component re-renders (which happens when
  // rootStore.session changes if component is wrapped in observer)
  useEffect(() => {
    const token = rootStore.session?.access_token || null;
    if (token !== sessionToken) {
      setSessionToken(token);
    }
  }, [rootStore.session, sessionToken]);

  useEffect(() => {
    let isCancelled = false;

    const checkAdmin = async () => {
      // Skip admin guard in playground mode
      if (isPlaygroundMode()) {
        if (!isCancelled) {
          setIsAdmin(true);
          setIsChecking(false);
        }
        return;
      }

      // If no session, wait for it to be available (on page reload, session loads asynchronously)
      // The useEffect will re-run when sessionToken changes, so we can just return early here
      if (!sessionToken) {
        // Don't redirect immediately - wait for session to load
        // The effect will re-run when session becomes available
        setIsChecking(true);
        return;
      }

      // Double-check cancellation before making API call
      if (isCancelled) return;

      try {
        // Determine the API endpoint based on backend choice
        const apiUrl =
          backend === "nest"
            ? `${process.env.NEXT_PUBLIC_NEST_URL || "http://localhost:3000"}/admin/check`
            : "/api/admin/check";

        const response = await fetchWithAuth(sessionToken, apiUrl);

        // Check cancellation after async operation
        if (isCancelled) return;

        if (!response.ok) {
          // Not an admin, redirect to home
          setIsChecking(false);
          router.replace("/home");
          return;
        }

        const data = await response.json();
        if (isCancelled) return;

        if (data.isAdmin) {
          setIsAdmin(true);
        } else {
          setIsChecking(false);
          router.replace("/home");
          return;
        }
      } catch (error) {
        if (isCancelled) return;
        console.error("Error checking admin status:", error);
        setIsChecking(false);
        router.replace("/home");
        return;
      } finally {
        if (!isCancelled) {
          setIsChecking(false);
        }
      }
    };

    checkAdmin();

    // Cleanup function to cancel if component unmounts or dependencies change
    return () => {
      isCancelled = true;
    };
  }, [sessionToken, router, backend]);

  return { isChecking, isAdmin };
}
