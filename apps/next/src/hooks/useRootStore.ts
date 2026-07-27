import { useContext } from "react";
import { RootStoreContext } from "@/context/rootStoreContext";

export function useRootStore() {
  const rootStore = useContext(RootStoreContext);

  if (!rootStore) {
    throw new Error("useRootStore must be used inside AppProviders");
  }

  return rootStore;
}
