import { useContext } from "react";
import { RootStoreContext } from "@/context/rootStoreContext";

export function useRootStore() {
  return useContext(RootStoreContext);
}
