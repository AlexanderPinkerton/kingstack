"use client";

import { useContext, useEffect } from "react";
import { AppSidebar } from "@/components/admin/app-sidebar";
import { ChartAreaInteractive } from "@/components/admin/chart-area-interactive";
import { DataTable } from "@/components/admin/data-table";
import { SectionCards } from "@/components/admin/section-cards";
import { SiteHeader } from "@/components/admin/site-header";
import { AdminManagement } from "@/components/admin/admin-management";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import useAdminGuard from "@/hooks/useAdminGuard";
import { RootStoreContext } from "@/context/rootStoreContext";

import data from "./data.json";

export default function Page() {
  // Use Next.js API route by default, or pass { backend: "nest" } to use NestJS
  const { isChecking, isAdmin } = useAdminGuard();
  const rootStore = useContext(RootStoreContext);

  // Initialize admin stores when admin access is confirmed and session is available
  useEffect(() => {
    if (isAdmin && rootStore.session && !rootStore.adminStore.initialized) {
      rootStore.adminStore.initializeWithSession(rootStore.session);
    }
  }, [isAdmin, rootStore.session, rootStore]);

  // Don't render anything until we've confirmed admin status
  if (isChecking || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-black to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Checking admin access...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              <div className="px-4 lg:px-6">
                <ChartAreaInteractive />
              </div>
              <div className="px-4 lg:px-6">
                <AdminManagement />
              </div>
              <DataTable data={data} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
