import {
  createOptimisticStore,
  type OptimisticStore,
  type ObservableUIData,
} from "@kingstack/advanced-optimistic-store";
import { TodoApiData } from "@/app/home/page";
import { TodoUiData } from "@/app/home/page";
import { fetchWithAuth } from "@/lib/utils";
import { getMockData, isPlaygroundMode } from "@kingstack/shapes";

export class AdvancedTodoStore {
  private optimisticStore: OptimisticStore<
    TodoApiData,
    TodoUiData,
    ObservableUIData<TodoUiData>
  > | null = null;
  private authToken: string | null = null;
  private isEnabled: boolean = false;

  constructor() {
    // Store is created but not enabled until auth is available
    this.initialize();
  }

  private initialize() {
    this.optimisticStore = createOptimisticStore<TodoApiData, TodoUiData>({
      name: "todos",
      queryFn: this.getQueryFn(),
      mutations: {
        create: this.getCreateMutation(),
        update: this.getUpdateMutation(),
        remove: this.getDeleteMutation(),
      },
      transformer: this.getTransformer(),
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: () =>
        this.isEnabled &&
        (!!this.authToken || this.authToken === "playground-token"),
    });
  }

  // Enable the store with auth token
  enable(authToken: string) {
    this.authToken = authToken;
    this.isEnabled = true;
    // Update the store options to enable the query
    this.optimisticStore?.updateOptions();
  }

  // Disable the store
  disable() {
    this.isEnabled = false;
    this.authToken = null;
    // Update the store options to disable the query
    this.optimisticStore?.updateOptions();
  }

  // Expose UI data (observable MobX state)
  get ui() {
    return this.optimisticStore?.ui || null;
  }

  // Expose API methods (mutations + query control)
  get api() {
    return this.optimisticStore?.api || null;
  }

  // Legacy getters for backward compatibility (deprecated)
  get store() {
    return this.ui;
  }

  get actions() {
    return this.api;
  }

  get status() {
    return this.api?.status || null;
  }

  // Check if store is ready and enabled
  get isReady() {
    return this.optimisticStore !== null && this.isEnabled;
  }

  // Manually trigger query (useful for debugging or manual refresh)
  triggerQuery() {
    this.optimisticStore?.api.triggerQuery();
  }

  // ============================================================================
  // PLAYGROUND CONFIGURATION
  // ============================================================================
  // All playground logic is centralized here for easy maintenance

  private getQueryFn() {
    return isPlaygroundMode() ? this.playgroundQueryFn : this.apiQueryFn;
  }

  private getCreateMutation() {
    return isPlaygroundMode()
      ? this.playgroundCreateMutation
      : this.apiCreateMutation;
  }

  private getUpdateMutation() {
    return isPlaygroundMode()
      ? this.playgroundUpdateMutation
      : this.apiUpdateMutation;
  }

  private getDeleteMutation() {
    return isPlaygroundMode()
      ? this.playgroundDeleteMutation
      : this.apiDeleteMutation;
  }

  private getTransformer() {
    return {
      toUi: (apiData: TodoApiData) => ({
        ...apiData,
        created_at: new Date(apiData.created_at),
        updated_at: new Date(apiData.updated_at),
      }),
      toApi: (uiData: TodoUiData) => ({
        ...uiData,
        created_at: uiData.created_at.toISOString(),
        updated_at: uiData.updated_at.toISOString(),
      }),
      optimisticDefaults: {
        createOptimisticUiData: (userInput: any) => ({
          id: `temp-${Date.now()}`,
          ...userInput,
          created_at: new Date(),
          updated_at: new Date(),
        }),
      },
    };
  }

  // API Implementations
  private apiQueryFn = async (): Promise<TodoApiData[]> => {
    const token = this.authToken || "";
    const baseUrl =
      process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
    return fetchWithAuth(token, `${baseUrl}/todos`).then((res) => res.json());
  };

  private apiCreateMutation = async (data: any): Promise<TodoApiData> => {
    const token = this.authToken || "";
    const baseUrl =
      process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
    return fetchWithAuth(token, `${baseUrl}/todos`, {
      method: "POST",
      body: JSON.stringify(data),
    }).then((res) => res.json());
  };

  private apiUpdateMutation = async ({
    id,
    data,
  }: {
    id: string;
    data: any;
  }): Promise<TodoApiData> => {
    const token = this.authToken || "";
    const baseUrl =
      process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
    return fetchWithAuth(token, `${baseUrl}/todos/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((res) => res.json());
  };

  private apiDeleteMutation = async (id: string): Promise<{ id: string }> => {
    const token = this.authToken || "";
    const baseUrl =
      process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
    const response = await fetchWithAuth(token, `${baseUrl}/todos/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(
        `Delete failed: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json();
    console.log("Delete mutation backend response:", result);
    return result;
  };

  // Playground Implementations
  private playgroundQueryFn = async (): Promise<TodoApiData[]> => {
    await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate delay
    return getMockData("todos") as TodoApiData[];
  };

  private playgroundCreateMutation = async (
    data: any,
  ): Promise<TodoApiData> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      id: `temp-${Date.now()}`,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: "playground-user",
    };
  };

  private playgroundUpdateMutation = async ({
    id,
    data,
  }: {
    id: string;
    data: any;
  }): Promise<TodoApiData> => {
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Get existing todo from mock data to preserve unchanged fields
    const existingTodos = getMockData("todos") as TodoApiData[];
    const existingTodo = existingTodos.find((t) => t.id === id);

    // If we have an existing todo, merge it with the updates
    if (existingTodo) {
      return {
        ...existingTodo,
        ...data, // This will override only the fields that were updated
        updated_at: new Date().toISOString(), // Always update the timestamp
      };
    }

    // Fallback if no existing todo found
    return {
      id,
      title: data.title || "Updated Todo",
      done: data.done || false,
      user_id: "playground-user",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
    };
  };

  private playgroundDeleteMutation = async (
    id: string,
  ): Promise<{ id: string }> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { id };
  };
}
