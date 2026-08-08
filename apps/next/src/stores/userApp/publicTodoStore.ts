// Shared todo demo store. Persistence requires a permanent account.

import {
  createOptimisticStore,
  type Entity,
  type OptimisticStore,
} from "@kingstack/advanced-optimistic-store";
import type { QueryClient } from "@tanstack/react-query";
import { StoreDemand } from "@/lib/store-lifecycle";
import { fetchWithAuth } from "@/lib/auth/authenticated-fetch";

// ---------- Types ----------

export interface PublicTodoApiData extends Entity {
  title: string;
  done: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface PublicTodoUiData extends Entity {
  title: string;
  done: boolean;
  user_id: string;
  created_at: Date;
  updated_at: Date;
}

// ---------- API Functions ----------

const API_BASE_URL =
  process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";

async function fetchPublicTodos(
  accessToken: string,
): Promise<PublicTodoApiData[]> {
  const response = await fetchWithAuth(
    accessToken,
    `${API_BASE_URL}/public/todos`,
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch todos: ${response.statusText}`);
  }
  return response.json();
}

async function createPublicTodo(
  data: {
    title: string;
  },
  accessToken: string,
): Promise<PublicTodoApiData> {
  const response = await fetchWithAuth(
    accessToken,
    `${API_BASE_URL}/public/todos`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to create todo: ${response.statusText}`);
  }
  return response.json();
}

async function updatePublicTodo(
  {
    id,
    data,
  }: {
    id: string;
    data: { title?: string; done?: boolean };
  },
  accessToken: string,
): Promise<PublicTodoApiData> {
  const response = await fetchWithAuth(
    accessToken,
    `${API_BASE_URL}/public/todos/${id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to update todo: ${response.statusText}`);
  }
  return response.json();
}

async function deletePublicTodo(
  id: string,
  accessToken: string,
): Promise<{ id: string }> {
  const response = await fetchWithAuth(
    accessToken,
    `${API_BASE_URL}/public/todos/${id}`,
    {
      method: "DELETE",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to delete todo: ${response.statusText}`);
  }
  return { id };
}

// ---------- Data Transformer ----------

const publicTodoTransformer = {
  toUi(apiData: PublicTodoApiData): PublicTodoUiData {
    return {
      id: apiData.id,
      title: apiData.title,
      done: apiData.done,
      user_id: apiData.user_id,
      created_at: new Date(apiData.created_at),
      updated_at: new Date(apiData.updated_at),
    };
  },

  toApi(uiData: PublicTodoUiData): PublicTodoApiData {
    return {
      id: uiData.id,
      title: uiData.title,
      done: uiData.done,
      user_id: uiData.user_id,
      created_at: uiData.created_at.toISOString(),
      updated_at: uiData.updated_at.toISOString(),
    };
  },

  optimisticDefaults: {
    createOptimisticUiData: (formData: { title: string }): PublicTodoUiData => {
      return {
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: formData.title,
        done: false,
        user_id: "public-demo-user",
        created_at: new Date(),
        updated_at: new Date(),
      };
    },
  },
};

// ---------- Public Todo Store Class ----------

export class PublicTodoStore {
  private readonly optimisticStore: OptimisticStore<
    PublicTodoApiData,
    PublicTodoUiData
  >;
  private readonly demand: StoreDemand;
  private accessToken: string | null = null;

  constructor(queryClient: QueryClient) {
    this.demand = new StoreDemand(() => this.optimisticStore.updateOptions());

    this.optimisticStore = createOptimisticStore<
      PublicTodoApiData,
      PublicTodoUiData
    >(
      {
        name: "publicTodos",
        queryFn: this.apiQueryFn,
        mutations: {
          create: this.apiCreateMutation,
          update: this.apiUpdateMutation,
          remove: this.apiDeleteMutation,
        },
        transformer: this.getTransformer(),
        staleTime: 2 * 60 * 1000,
        enabled: () => this.demand.isActive && this.accessToken !== null,
      },
      queryClient,
    );
  }

  activate(): () => void {
    return this.demand.activate();
  }

  setAccessToken(accessToken: string | null): void {
    if (this.accessToken === accessToken) return;
    this.accessToken = accessToken;
    this.optimisticStore.updateOptions();
  }

  dispose(): void {
    this.demand.dispose();
    this.optimisticStore.destroy();
  }

  // ---------- Store Access Methods ----------

  get todos(): PublicTodoUiData[] {
    return this.optimisticStore.ui.list;
  }

  get count(): number {
    return this.optimisticStore.ui.count;
  }

  get isLoading(): boolean {
    return this.optimisticStore.api.status.isLoading;
  }

  get isError(): boolean {
    return this.optimisticStore.api.status.isError;
  }

  get error(): Error | null {
    return this.optimisticStore.api.status.error || null;
  }

  get createPending(): boolean {
    return this.optimisticStore.api.status.createPending;
  }

  get updatePending(): boolean {
    return this.optimisticStore.api.status.updatePending;
  }

  get deletePending(): boolean {
    return this.optimisticStore.api.status.deletePending;
  }

  // ---------- Actions ----------

  get ui() {
    return this.optimisticStore.ui;
  }

  get api() {
    return this.optimisticStore.api;
  }

  // ---------- Private Methods ----------

  private getTransformer() {
    return publicTodoTransformer;
  }

  // API Implementations
  private apiQueryFn = async (): Promise<PublicTodoApiData[]> => {
    return fetchPublicTodos(this.requireAccessToken());
  };

  private apiCreateMutation = async (data: {
    title: string;
  }): Promise<PublicTodoApiData> => {
    return createPublicTodo(data, this.requireAccessToken());
  };

  private apiUpdateMutation = async ({
    id,
    data,
  }: {
    id: string;
    data: { title?: string; done?: boolean };
  }): Promise<PublicTodoApiData> => {
    return updatePublicTodo({ id, data }, this.requireAccessToken());
  };

  private apiDeleteMutation = async (id: string): Promise<{ id: string }> => {
    return deletePublicTodo(id, this.requireAccessToken());
  };

  private requireAccessToken(): string {
    if (!this.accessToken) {
      throw new Error("A permanent account is required for shared todo data");
    }
    return this.accessToken;
  }
}
