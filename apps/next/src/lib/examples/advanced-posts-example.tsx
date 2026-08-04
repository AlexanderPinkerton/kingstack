"use client";

import { observer } from "mobx-react-lite";
import { useRootStore } from "@/hooks/useRootStore";
import { AdvancedPostsExampleView } from "./advanced-posts-view";

export const AdvancedPostsExample = observer(() => {
  const rootStore = useRootStore();

  return (
    <AdvancedPostsExampleView
      postStore={rootStore.userStore.postStore}
      demoController={rootStore.userStore.optimisticPostDemoController}
      currentUserId={rootStore.session?.user?.id ?? "unknown"}
    />
  );
});
