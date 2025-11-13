import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RootStoreContext } from "@/context/rootStoreContext";
import { isPlaygroundMode } from "@kingstack/shared";
import { fetchWithAuth } from "@/lib/utils";

export default function useAdminGuard() {
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
        const response = await fetchWithAuth(
          rootStore.session.access_token,
          "/api/admin/check",
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
