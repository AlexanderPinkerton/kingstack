import {
  createOptimisticStore,
  type OptimisticStore,
} from "@kingstack/advanced-optimistic-store";
import type { QueryClient } from "@tanstack/react-query";
import {
  fetchWithAuth,
  readJsonResponse,
} from "@/lib/auth/authenticated-fetch";
import type { SupabaseSession } from "@/lib/session-manager";
import { StoreDemand } from "@/lib/store-lifecycle";

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
  private readonly optimisticStore: OptimisticStore<
    AdminEmailApiData,
    AdminEmailUiData
  >;
  private readonly demand: StoreDemand;
  private session: SupabaseSession = null;

  constructor(queryClient: QueryClient) {
    this.demand = new StoreDemand(() => this.optimisticStore.updateOptions());

    this.optimisticStore = createOptimisticStore<
      AdminEmailApiData,
      AdminEmailUiData
    >(
      {
        name: "admin-emails",
        queryKey: () => ["admin-emails", this.sessionIdentity],
        queryFn: this.apiQueryFn,
        mutations: {
          create: this.apiCreateMutation,
          update: this.apiUpdateMutation,
          remove: this.apiDeleteMutation,
        },
        transformer: this.getTransformer(),
        staleTime: 2 * 60 * 1000,
        enabled: () =>
          this.demand.isActive && Boolean(this.session?.access_token),
      },
      queryClient,
    );
  }

  activate(): () => void {
    return this.demand.activate();
  }

  setSession(session: SupabaseSession): void {
    const previousIdentity = this.sessionIdentity;
    this.session = session;

    if (previousIdentity !== this.sessionIdentity) {
      this.optimisticStore.ui.clear();
    }

    this.optimisticStore.updateOptions();
  }

  dispose(): void {
    this.demand.dispose();
    this.optimisticStore.destroy();
  }

  // Expose UI data (observable MobX state)
  get ui() {
    return this.optimisticStore.ui;
  }

  // Expose API methods (mutations + query control)
  get api() {
    return this.optimisticStore.api;
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
    const token = this.session?.access_token || "";
    const baseUrl =
      process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
    const response = await fetchWithAuth(token, `${baseUrl}/admin/emails`);
    return readJsonResponse<AdminEmailApiData[]>(response);
  };

  private apiCreateMutation = async (data: {
    email: string;
  }): Promise<AdminEmailApiData> => {
    const token = this.session?.access_token || "";
    const baseUrl =
      process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
    const response = await fetchWithAuth(token, `${baseUrl}/admin/emails`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return readJsonResponse<AdminEmailApiData>(response);
  };

  private apiUpdateMutation = async ({
    id,
    data,
  }: {
    id: string;
    data: { email: string };
  }): Promise<AdminEmailApiData> => {
    const token = this.session?.access_token || "";
    const baseUrl =
      process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
    const response = await fetchWithAuth(
      token,
      `${baseUrl}/admin/emails/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
    return readJsonResponse<AdminEmailApiData>(response);
  };

  private apiDeleteMutation = async (id: string): Promise<{ id: string }> => {
    const token = this.session?.access_token || "";
    const baseUrl =
      process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
    const response = await fetchWithAuth(
      token,
      `${baseUrl}/admin/emails/${id}`,
      {
        method: "DELETE",
      },
    );

    return readJsonResponse<{ id: string }>(response);
  };

  private get sessionIdentity(): string {
    return this.session?.user.id ?? "anonymous";
  }
}
