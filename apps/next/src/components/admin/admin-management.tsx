"use client";

import React, { useContext, useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { RootStoreContext } from "@/context/rootStoreContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { IconPlus, IconTrash, IconLoader } from "@tabler/icons-react";
import { toast } from "sonner";

export const AdminManagement = observer(() => {
  const rootStore = useContext(RootStoreContext);
  const [isClient, setIsClient] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize admin store when component mounts
  useEffect(() => {
    setIsClient(true);
    if (rootStore.session) {
      rootStore.adminStore.initializeWithSession(rootStore.session);
    }
  }, [rootStore.session]);

  // Get the admin management store
  const adminMgmtStore = rootStore.adminStore.adminMgmtStore;
  const { ui, api } = adminMgmtStore;

  // Prevent hydration mismatch
  if (!isClient || !ui) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading admin management...</div>
      </div>
    );
  }

  const admins = ui.list || [];
  const isLoading = api?.status.isLoading || false;
  const isCreating = api?.status.createPending || false;
  const isDeleting = api?.status.deletePending || false;

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !api) return;

    setIsSubmitting(true);
    try {
      await api.create({ email: newEmail.trim() });
      setNewEmail("");
      setIsDialogOpen(false);
      toast.success("Admin email added successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to add admin email");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAdmin = async (id: string) => {
    if (!api) return;

    if (!confirm("Are you sure you want to remove this admin?")) {
      return;
    }

    try {
      await api.remove(id);
      toast.success("Admin email removed successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to remove admin email");
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Admin Management</h2>
          <p className="text-muted-foreground mt-1">
            Manage admin email addresses
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <IconPlus className="mr-2 h-4 w-4" />
              Add Admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleAddAdmin}>
              <DialogHeader>
                <DialogTitle>Add Admin Email</DialogTitle>
                <DialogDescription>
                  Enter the email address to grant admin access.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  type="email"
                  placeholder="admin@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  disabled={isSubmitting || isCreating}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting || isCreating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || isCreating}>
                  {isSubmitting || isCreating ? (
                    <>
                      <IconLoader className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Admin"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <IconLoader className="h-6 w-6 animate-spin mr-2" />
          <span>Loading admins...</span>
        </div>
      ) : admins.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No admin emails found. Add your first admin above.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">
                    {admin.displayEmail}
                  </TableCell>
                  <TableCell>{admin.created_at.toLocaleDateString()}</TableCell>
                  <TableCell>
                    {admin.isRecent && (
                      <Badge variant="secondary">Recent</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAdmin(admin.id)}
                      disabled={isDeleting || admin.id.startsWith("temp-")}
                    >
                      <IconTrash className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
});
