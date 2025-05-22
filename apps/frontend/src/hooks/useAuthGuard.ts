import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RootStoreContext } from "@/context/rootStoreContext";

export default function useAuthGuard() {
  const rootStore = useContext(RootStoreContext);
  const router = useRouter();

  useEffect(() => {
    if (!rootStore.session) {
      router.replace("/login");
    }
  }, [rootStore.session, router]);
}
