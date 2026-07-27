import type { QueryClient } from "@tanstack/react-query";
import type { SupabaseSession } from "@/lib/session-manager";
import { AdminMgmtStore } from "./adminMgmtStore";

/**
 * Typed container for admin-facing stores.
 *
 * Construction does not fetch. Admin queries are activated by the admin feature
 * boundary and remain gated by the current authenticated session.
 */
export class AdminStoreManager {
  readonly adminMgmtStore: AdminMgmtStore;

  private isDisposed = false;

  constructor(queryClient: QueryClient) {
    this.adminMgmtStore = new AdminMgmtStore(queryClient);
  }

  updateSession(session: SupabaseSession): void {
    if (this.isDisposed) return;
    this.adminMgmtStore.setSession(session);
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.adminMgmtStore.dispose();
  }
}
