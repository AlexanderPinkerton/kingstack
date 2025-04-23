import { createContext } from "react";

import { RootStore } from '@/stores/rootStore'

const rootStore = new RootStore();

export const RootStoreContext = createContext(rootStore);