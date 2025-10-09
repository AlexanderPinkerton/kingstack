import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RootStoreContext } from "@/context/rootStoreContext";
import { isPlaygroundMode } from "@kingstack/shapes";

export default function useAuthGuard() {
  const rootStore = useContext(RootStoreContext);
  const router = useRouter();

  useEffect(() => {
    // Skip auth guard in playground mode
    if (isPlaygroundMode()) {
      return;
    }

    if (!rootStore.session) {
      router.replace("/login");
    }
  }, [rootStore.session, router]);
}
