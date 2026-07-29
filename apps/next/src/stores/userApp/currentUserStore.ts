import {
  createOptimisticStore,
  type OptimisticStore,
  type DataTransformer,
} from "@kingstack/advanced-optimistic-store";
import type { QueryClient } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/utils";
import type { SupabaseSession } from "@/lib/session-manager";
import { StoreDemand } from "@/lib/store-lifecycle";
import { getMockData, isPlaygroundMode } from "@kingstack/shared";

// API data structure (what comes from the server)
export interface CurrentUserApiData {
  id: string;
  email: string;
  username: string;
  username_changed_at: string | null;
  previous_usernames: string[];
  created_at: string; // ISO string from server
}

// UI data structure (enhanced for the frontend)
export interface CurrentUserUiData {
  id: string;
  email: string;
  username: string;
  username_changed_at: Date | null;
  previous_usernames: string[];
  created_at: Date;
  // UI-only computed fields
  displayName: string; // username or email fallback
  canChangeUsername: boolean; // based on username_changed_at
  accountAge: number; // in days
  isNewUser: boolean; // account created in last 7 days
}

// Transformer to convert API data to UI data with computed fields
class CurrentUserTransformer implements DataTransformer<
  CurrentUserApiData,
  CurrentUserUiData
> {
  toUi(apiData: CurrentUserApiData): CurrentUserUiData {
    const created_at = new Date(apiData.created_at);
    const username_changed_at = apiData.username_changed_at
      ? new Date(apiData.username_changed_at)
      : null;

    const now = new Date();
    const accountAge = Math.floor(
      (now.getTime() - created_at.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      id: apiData.id,
      email: apiData.email,
      username: apiData.username,
      username_changed_at,
      previous_usernames: apiData.previous_usernames,
      created_at,
      displayName: apiData.username || apiData.email,
      canChangeUsername:
        !username_changed_at ||
        now.getTime() - username_changed_at.getTime() >
          30 * 24 * 60 * 60 * 1000, // 30 days
      accountAge,
      isNewUser: accountAge <= 7,
    };
  }

  toApi(uiData: CurrentUserUiData): CurrentUserApiData {
    return {
      id: uiData.id,
      email: uiData.email,
      username: uiData.username,
      username_changed_at: uiData.username_changed_at?.toISOString() || null,
      previous_usernames: uiData.previous_usernames,
      created_at: uiData.created_at.toISOString(),
    };
  }
}

export class CurrentUserStore {
  private readonly optimisticStore: OptimisticStore<
    CurrentUserApiData,
    CurrentUserUiData
  >;
  private readonly transformer = new CurrentUserTransformer();
  private readonly demand: StoreDemand;
  private session: SupabaseSession = null;

  constructor(queryClient: QueryClient) {
    this.demand = new StoreDemand(() => this.optimisticStore.updateOptions());

    this.optimisticStore = createOptimisticStore<
      CurrentUserApiData,
      CurrentUserUiData
    >(
      {
        name: "user",
        queryKey: () => ["user", this.sessionIdentity],
        queryFn: this.getQueryFn(),
        mutations: {
          create: this.getCreateMutation(),
          update: this.getUpdateMutation(),
          remove: this.getDeleteMutation(),
        },
        transformer: this.transformer,
        staleTime: 10 * 60 * 1000,
        enabled: () =>
          this.demand.isActive &&
          (!!this.session?.access_token || isPlaygroundMode()),
      },
      queryClient,
    );
  }

  // API Implementations
  private apiQueryFn = async (): Promise<CurrentUserApiData[]> => {
    const token = this.session?.access_token || "";
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3069";
    const currentUser = await fetchWithAuth(token, `${baseUrl}/api/user`).then(
      (res) => res.json(),
    );
    // Wrap single user object in array since optimistic store expects array of entities
    return [currentUser];
  };

  private apiCreateMutation = async (
    data: any,
  ): Promise<CurrentUserApiData> => {
    const token = this.session?.access_token || "";
    const baseUrl =
      process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
    return fetchWithAuth(token, `${baseUrl}/api/user`, {
      method: "POST",
      body: JSON.stringify(data),
    }).then((res) => res.json());
  };

  private apiUpdateMutation = async ({
    data,
  }: {
    id: string;
    data: any;
  }): Promise<CurrentUserApiData> => {
    const token = this.session?.access_token || "";
    const baseUrl =
      process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
    return fetchWithAuth(token, `${baseUrl}/api/user`, {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((res) => res.json());
  };

  private apiDeleteMutation = async (): Promise<{ id: string }> => {
    const token = this.session?.access_token || "";
    const baseUrl =
      process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
    const response = await fetchWithAuth(token, `${baseUrl}/api/user`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(
        `Delete failed: ${response.status} ${response.statusText}`,
      );
    }
    return response.json();
  };

  // Playground Implementations
  private playgroundQueryFn = async (): Promise<CurrentUserApiData[]> => {
    await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate delay
    const mockUsers = getMockData<CurrentUserApiData>("users");
    // Transform mock data to match CurrentUserApiData interface
    const userData: CurrentUserApiData = {
      id: mockUsers[0]?.id || "playground-user",
      email: mockUsers[0]?.email || "playground@kingstack.dev",
      username: "playground-user",
      username_changed_at: null,
      previous_usernames: [],
      created_at: mockUsers[0]?.created_at || new Date().toISOString(),
    };
    return [userData];
  };

  private playgroundCreateMutation = async (
    data: any,
  ): Promise<CurrentUserApiData> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      id: `temp-${Date.now()}`,
      email: data.email || "playground@kingstack.dev",
      username: data.username || "playground-user",
      username_changed_at: null,
      previous_usernames: [],
      created_at: new Date().toISOString(),
      ...data,
    };
  };

  private playgroundUpdateMutation = async ({
    id,
    data,
  }: {
    id: string;
    data: any;
  }): Promise<CurrentUserApiData> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      id,
      email: "playground@kingstack.dev",
      username: "playground-user",
      username_changed_at: null,
      previous_usernames: [],
      created_at: new Date().toISOString(),
      ...data,
    };
  };

  private playgroundDeleteMutation = async (
    id: string,
  ): Promise<{ id: string }> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { id };
  };

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

  // Convenience method to get current user data
  get currentUser(): CurrentUserUiData | null {
    // For user data, we expect a single entity, so get the first one
    return this.ui.list[0] ?? null;
  }

  private get sessionIdentity(): string {
    if (isPlaygroundMode()) return "playground";
    return this.session?.user.id ?? "anonymous";
  }
}
