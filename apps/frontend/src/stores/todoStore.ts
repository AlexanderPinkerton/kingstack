import {
  createOptimisticStore,
  type OptimisticStore,
} from "@kingstack/advanced-optimistic-store";
import { TodoApiData } from "@/app/home/page";
import { TodoUiData } from "@/app/home/page";
import { fetchWithAuth } from "@/lib/utils";

export class AdvancedTodoStore {
  private optimisticStore: OptimisticStore<TodoApiData, TodoUiData> | null =
    null;
  private authToken: string | null = null;
  private isEnabled: boolean = false;

  constructor() {
    // Store is created but not enabled until auth is available
    this.initialize();
  }

  private initialize() {
    this.optimisticStore = createOptimisticStore<TodoApiData, TodoUiData>({
      name: "todos",
      queryFn: async () => {
        const token = this.authToken || "";
        const baseUrl =
          process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
        return fetchWithAuth(token, `${baseUrl}/todos`).then((res) =>
          res.json(),
        );
      },
      mutations: {
        create: async (data) => {
          const token = this.authToken || "";
          const baseUrl =
            process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
          return fetchWithAuth(token, `${baseUrl}/todos`, {
            method: "POST",
            body: JSON.stringify(data),
          }).then((res) => res.json());
        },

        update: async ({ id, data }) => {
          const token = this.authToken || "";
          const baseUrl =
            process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
          return fetchWithAuth(token, `${baseUrl}/todos/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
          }).then((res) => res.json());
        },

        remove: async (id) => {
          const token = this.authToken || "";
          const baseUrl =
            process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
          const response = await fetchWithAuth(
            token,
            `${baseUrl}/todos/${id}`,
            {
              method: "DELETE",
            },
          );

          if (!response.ok) {
            throw new Error(
              `Delete failed: ${response.status} ${response.statusText}`,
            );
          }

          const result = await response.json();
          console.log("Delete mutation backend response:", result);
          return result;
        },
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: () => this.isEnabled && !!this.authToken, // Only run when enabled and we have a token
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
}
