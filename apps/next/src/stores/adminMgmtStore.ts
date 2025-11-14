import {
  createOptimisticStore,
  type OptimisticStore,
  type ObservableUIData,
} from "@kingstack/advanced-optimistic-store";
import { fetchWithAuth } from "@/lib/utils";
import { getMockData, isPlaygroundMode } from "@kingstack/shared";

// API data structure (what comes from the server)
export interface AdminEmailApiData {
  id: string;
  email: string;
  created_at: string; // ISO string from server
}

// UI data structure (enhanced for the frontend)
export interface AdminEmailUiData {
  id: string;
  email: string;
  created_at: Date;
  // UI-only computed fields
  isRecent: boolean; // added in last 7 days
  displayEmail: string; // formatted email for display
}

export class AdminMgmtStore {
  private optimisticStore: OptimisticStore<
    AdminEmailApiData,
    AdminEmailUiData,
    ObservableUIData<AdminEmailUiData>
  > | null = null;
  private authToken: string | null = null;
  private isEnabled: boolean = false;

  constructor() {
    // Store is created but not enabled until auth is available
    this.initialize();
  }

  private initialize() {
    this.optimisticStore = createOptimisticStore<
      AdminEmailApiData,
      AdminEmailUiData
    >({
      name: "admin-emails",
      queryFn: this.getQueryFn(),
      mutations: {
        create: this.getCreateMutation(),
        update: this.getUpdateMutation(),
        remove: this.getDeleteMutation(),
      },
      transformer: this.getTransformer(),
      staleTime: 2 * 60 * 1000, // 2 minutes (admin list changes infrequently)
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
      toUi: (apiData: AdminEmailApiData): AdminEmailUiData => {
        const created_at = new Date(apiData.created_at);
        const now = new Date();
        const daysSinceCreation = Math.floor(
          (now.getTime() - created_at.getTime()) / (1000 * 60 * 60 * 24),
        );

        return {
          id: apiData.id,
          email: apiData.email,
          created_at,
          isRecent: daysSinceCreation <= 7,
          displayEmail: apiData.email.toLowerCase().trim(),
        };
      },
      toApi: (uiData: AdminEmailUiData): AdminEmailApiData => {
        return {
          id: uiData.id,
          email: uiData.email,
          created_at: uiData.created_at.toISOString(),
        };
      },
      optimisticDefaults: {
        createOptimisticUiData: (userInput: { email: string }) => ({
          id: `temp-${Date.now()}`,
          email: userInput.email,
          created_at: new Date(),
          isRecent: true,
          displayEmail: userInput.email.toLowerCase().trim(),
        }),
      },
    };
  }

  // API Implementations
  private apiQueryFn = async (): Promise<AdminEmailApiData[]> => {
    const token = this.authToken || "";
    const baseUrl = process.env.NEXT_PUBLIC_NEST_URL || "http://localhost:3000";
    return fetchWithAuth(token, `${baseUrl}/admin/emails`).then((res) =>
      res.json(),
    );
  };

  private apiCreateMutation = async (data: {
    email: string;
  }): Promise<AdminEmailApiData> => {
    const token = this.authToken || "";
    const baseUrl = process.env.NEXT_PUBLIC_NEST_URL || "http://localhost:3000";
    return fetchWithAuth(token, `${baseUrl}/admin/emails`, {
      method: "POST",
      body: JSON.stringify(data),
    }).then((res) => res.json());
  };

  private apiUpdateMutation = async ({
    id,
    data,
  }: {
    id: string;
    data: { email: string };
  }): Promise<AdminEmailApiData> => {
    const token = this.authToken || "";
    const baseUrl = process.env.NEXT_PUBLIC_NEST_URL || "http://localhost:3000";
    return fetchWithAuth(token, `${baseUrl}/admin/emails/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((res) => res.json());
  };

  private apiDeleteMutation = async (id: string): Promise<{ id: string }> => {
    const token = this.authToken || "";
    const baseUrl = process.env.NEXT_PUBLIC_NEST_URL || "http://localhost:3000";
    const response = await fetchWithAuth(
      token,
      `${baseUrl}/admin/emails/${id}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      throw new Error(
        `Delete failed: ${response.status} ${response.statusText}`,
      );
    }
    return response.json();
  };

  // Playground Implementations
  private playgroundQueryFn = async (): Promise<AdminEmailApiData[]> => {
    await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate delay
    const mockAdmins = getMockData("admin-emails") as any[];
    if (!mockAdmins || mockAdmins.length === 0) {
      // Return some default mock data
      return [
        {
          id: "admin-1",
          email: "admin@example.com",
          created_at: new Date().toISOString(),
        },
        {
          id: "admin-2",
          email: "superadmin@example.com",
          created_at: new Date(
            Date.now() - 8 * 24 * 60 * 60 * 1000,
          ).toISOString(), // 8 days ago
        },
      ];
    }
    return mockAdmins.map((admin) => ({
      id: admin.id || `admin-${Date.now()}`,
      email: admin.email || "admin@example.com",
      created_at: admin.created_at || new Date().toISOString(),
    }));
  };

  private playgroundCreateMutation = async (data: {
    email: string;
  }): Promise<AdminEmailApiData> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      id: `admin-${Date.now()}`,
      email: data.email,
      created_at: new Date().toISOString(),
    };
  };

  private playgroundUpdateMutation = async ({
    id,
    data,
  }: {
    id: string;
    data: { email: string };
  }): Promise<AdminEmailApiData> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      id,
      email: data.email,
      created_at: new Date().toISOString(),
    };
  };

  private playgroundDeleteMutation = async (
    id: string,
  ): Promise<{ id: string }> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { id };
  };
}
