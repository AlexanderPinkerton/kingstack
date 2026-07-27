"use client";

import { createContext } from "react";
import type { RootStore } from "@/stores/rootStore";

export const RootStoreContext = createContext<RootStore | null>(null);
