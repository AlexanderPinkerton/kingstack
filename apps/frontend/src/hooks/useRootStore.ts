import { useContext } from "react";
import { RootStoreContext } from "@/context/rootStoreContext";

export const useRootStore = () => {
  const context = useContext(RootStoreContext);
  if (!context) {
    throw new Error("useRootStore must be used within a RootStoreProvider");
  }
  return context;
};
