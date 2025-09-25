import { createOptimisticStoreManager, OptimisticStoreManager } from "@/lib/optimistic-store-pattern";
import { TodoApiData } from "@/app/home/page";
import { TodoUiData } from "@/app/home/page";
import { fetchWithAuth } from "@/lib/utils";

export class AdvancedTodoStore {
    private storeManager: OptimisticStoreManager<TodoApiData, TodoUiData> | null = null;
    private authToken: string | null = null;
    private isEnabled: boolean = false;
    
    constructor() {
        // Store is created but not enabled until auth is available
        this.initialize();
    }

    private initialize() {
        this.storeManager = createOptimisticStoreManager<TodoApiData, TodoUiData>(
            {
                name: "todos",
                queryFn: async () => {
                    const token = this.authToken || "";
                    const baseUrl =
                        process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
                    return fetchWithAuth(token, `${baseUrl}/todos`).then((res) => res.json());
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
                        const response = await fetchWithAuth(token, `${baseUrl}/todos/${id}`, {
                            method: "DELETE",
                        });
                        
                        if (!response.ok) {
                            throw new Error(`Delete failed: ${response.status} ${response.statusText}`);
                        }
                        
                        const result = await response.json();
                        console.log("Delete mutation backend response:", result);
                        return result;
                    },
                },
                staleTime: 5 * 60 * 1000, // 5 minutes
                enabled: () => this.isEnabled && !!(this.authToken), // Only run when enabled and we have a token
            });
    }

    // Enable the store with auth token
    enable(authToken: string) {
        this.authToken = authToken;
        this.isEnabled = true;
        // Update the store manager options to enable the query
        this.storeManager?.updateOptions();
    }

    // Disable the store
    disable() {
        this.isEnabled = false;
        this.authToken = null;
        // Update the store manager options to disable the query
        this.storeManager?.updateOptions();
    }

    // Expose store manager properties directly for easy access
    get store() {
        return this.storeManager?.store || null;
    }

    get actions() {
        return this.storeManager?.actions || null;
    }

    get status() {
        return this.storeManager?.status || null;
    }

    // Check if store is ready and enabled
    get isReady() {
        return this.storeManager !== null && this.isEnabled;
    }

    // Manually trigger query (useful for debugging or manual refresh)
    triggerQuery() {
        this.storeManager?.actions?.triggerQuery();
    }
}
