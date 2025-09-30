import {
  createOptimisticStoreManager,
  OptimisticStoreManager,
  DataTransformer,
} from "@kingstack/advanced-optimistic-store";
import { fetchWithAuth } from "@/lib/utils";

// API data structure (what comes from the server)
export interface UserApiData {
  id: string;
  email: string;
  username: string;
  username_changed_at: string | null;
  previous_usernames: string[];
  created_at: string; // ISO string from server
}

// UI data structure (enhanced for the frontend)
export interface UserUiData {
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
class UserTransformer implements DataTransformer<UserApiData, UserUiData> {
  toUi(apiData: UserApiData): UserUiData {
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

  toApi(uiData: UserUiData): UserApiData {
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

export class AdvancedUserStore {
  private storeManager: OptimisticStoreManager<UserApiData, UserUiData> | null =
    null;
  private authToken: string | null = null;
  private isEnabled: boolean = false;
  private transformer = new UserTransformer();

  constructor() {
    // Store is created but not enabled until auth is available
    this.initialize();
  }

  private initialize() {
    this.storeManager = createOptimisticStoreManager<UserApiData, UserUiData>({
      name: "user",
      queryFn: async () => {
        const token = this.authToken || "";
        const baseUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3069";
        const user = await fetchWithAuth(token, `${baseUrl}/api/user`).then(
          (res) => res.json(),
        );
        // Wrap single user object in array since optimistic store expects array of entities
        return [user];
      },
      mutations: {
        create: async (data) => {
          const token = this.authToken || "";
          const baseUrl =
            process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
          return fetchWithAuth(token, `${baseUrl}/api/user`, {
            method: "POST",
            body: JSON.stringify(data),
          }).then((res) => res.json());
        },
        update: async ({ id, data }) => {
          const token = this.authToken || "";
          const baseUrl =
            process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
          return fetchWithAuth(token, `${baseUrl}/api/user`, {
            method: "PUT",
            body: JSON.stringify(data),
          }).then((res) => res.json());
        },
        remove: async (id) => {
          const token = this.authToken || "";
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
        },
      },
      transformer: this.transformer,
      staleTime: 10 * 60 * 1000, // 10 minutes (user data changes less frequently)
      enabled: () => this.isEnabled && !!this.authToken, // Only run when enabled and we have a token
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

  // Convenience method to get current user data
  get currentUser() {
    if (!this.store?.entities) return null;
    // For user data, we expect a single entity, so get the first one
    const entities = Array.from(this.store.entities.values());
    return entities[0] || null;
  }
}
