// Public Todo Store - Works without authentication
// Uses the optimistic store pattern similar to checkboxes

import {
  createOptimisticStore,
  Entity,
} from "@kingstack/advanced-optimistic-store";
import { getMockData, isPlaygroundMode } from "@kingstack/shared";

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
  process.env.NEXT_PUBLIC_NEST_URL || "http://localhost:3000";

async function fetchPublicTodos(): Promise<PublicTodoApiData[]> {
  const response = await fetch(`${API_BASE_URL}/public/todos`);
  if (!response.ok) {
    throw new Error(`Failed to fetch todos: ${response.statusText}`);
  }
  return response.json();
}

async function createPublicTodo(data: {
  title: string;
}): Promise<PublicTodoApiData> {
  const response = await fetch(`${API_BASE_URL}/public/todos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to create todo: ${response.statusText}`);
  }
  return response.json();
}

async function updatePublicTodo({
  id,
  data,
}: {
  id: string;
  data: { title?: string; done?: boolean };
}): Promise<PublicTodoApiData> {
  const response = await fetch(`${API_BASE_URL}/public/todos/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to update todo: ${response.statusText}`);
  }
  return response.json();
}

async function deletePublicTodo(id: string): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE_URL}/public/todos/${id}`, {
    method: "DELETE",
  });
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
    createOptimisticUiData: (
      formData: { title: string },
      context?: any,
    ): PublicTodoUiData => {
      return {
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: formData.title,
        done: false,
        user_id: "public-demo-user",
        created_at: new Date(),
        updated_at: new Date(),
      };
    },
    pendingFields: [] as (keyof PublicTodoUiData)[],
  },
};

// ---------- Public Todo Store Class ----------

export class PublicTodoStore {
  public optimisticStore: ReturnType<
    typeof createOptimisticStore<PublicTodoApiData, PublicTodoUiData>
  >;

  constructor() {
    this.optimisticStore = createOptimisticStore<
      PublicTodoApiData,
      PublicTodoUiData
    >({
      name: "publicTodos",
      queryFn: this.getQueryFn(),
      mutations: {
        create: this.getCreateMutation(),
        update: this.getUpdateMutation(),
        remove: this.getDeleteMutation(),
      },
      transformer: this.getTransformer(),
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
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

  private getQueryFn() {
    if (isPlaygroundMode()) {
      return this.playgroundQueryFn;
    }
    return this.apiQueryFn;
  }

  private getCreateMutation() {
    if (isPlaygroundMode()) {
      return this.playgroundCreateMutation;
    }
    return this.apiCreateMutation;
  }

  private getUpdateMutation() {
    if (isPlaygroundMode()) {
      return this.playgroundUpdateMutation;
    }
    return this.apiUpdateMutation;
  }

  private getDeleteMutation() {
    if (isPlaygroundMode()) {
      return this.playgroundDeleteMutation;
    }
    return this.apiDeleteMutation;
  }

  private getTransformer() {
    return publicTodoTransformer;
  }

  // API Implementations
  private apiQueryFn = async (): Promise<PublicTodoApiData[]> => {
    return fetchPublicTodos();
  };

  private apiCreateMutation = async (data: {
    title: string;
  }): Promise<PublicTodoApiData> => {
    return createPublicTodo(data);
  };

  private apiUpdateMutation = async ({
    id,
    data,
  }: {
    id: string;
    data: { title?: string; done?: boolean };
  }): Promise<PublicTodoApiData> => {
    return updatePublicTodo({ id, data });
  };

  private apiDeleteMutation = async (id: string): Promise<{ id: string }> => {
    return deletePublicTodo(id);
  };

  // Playground Implementations
  private playgroundQueryFn = async (): Promise<PublicTodoApiData[]> => {
    await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate delay
    return getMockData("todos") as PublicTodoApiData[];
  };

  private playgroundCreateMutation = async (data: {
    title: string;
  }): Promise<PublicTodoApiData> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: data.title,
      done: false,
      user_id: "public-demo-user",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  };

  private playgroundUpdateMutation = async ({
    id,
    data,
  }: {
    id: string;
    data: { title?: string; done?: boolean };
  }): Promise<PublicTodoApiData> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const existing = (await this.playgroundQueryFn()).find((t) => t.id === id);
    if (!existing) {
      throw new Error("Todo not found");
    }
    return {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
  };

  private playgroundDeleteMutation = async (
    id: string,
  ): Promise<{
    id: string;
  }> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { id };
  };
}
