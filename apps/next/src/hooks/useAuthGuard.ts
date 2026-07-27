import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { autorun } from "mobx";
import { useRootStore } from "@/hooks/useRootStore";
import { isPlaygroundMode } from "@kingstack/shared";

export default function useAuthGuard() {
  const rootStore = useRootStore();
  const router = useRouter();

  useEffect(
    () =>
      autorun(() => {
        if (
          !isPlaygroundMode() &&
          rootStore.sessionReady &&
          !rootStore.session
        ) {
          router.replace("/login");
        }
      }),
    [rootStore, router],
  );
}
