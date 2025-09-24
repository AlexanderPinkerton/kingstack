import { createOptimisticStore, OptimisticStore } from "@/lib/optimistic-store-pattern";
import { CheckboxApiData, CheckboxUiData } from "./types/checkbox";

// Get the backend URL
const baseUrl = process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";

// API functions
const fetchCheckboxes = async (): Promise<CheckboxApiData[]> => {
  const response = await fetch(`${baseUrl}/checkboxes`);
  if (!response.ok) {
    throw new Error("Failed to fetch checkboxes");
  }
  return response.json();
};

const createCheckbox = async (data: { index: number; checked: boolean }): Promise<CheckboxApiData> => {
  const response = await fetch(`${baseUrl}/checkboxes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to create/update checkbox");
  }
  return response.json();
};

const updateCheckbox = async ({ id, data }: { id: string; data: { index: number; checked: boolean } }): Promise<CheckboxApiData> => {
  const response = await fetch(`${baseUrl}/checkboxes/${data.index}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ checked: data.checked }),
  });
  if (!response.ok) {
    throw new Error("Failed to update checkbox");
  }
  return response.json();
};

const removeCheckbox = async (id: string): Promise<{ id: string }> => {
  // For checkboxes, we'll use the index as the identifier
  const index = parseInt(id);
  const response = await fetch(`${baseUrl}/checkboxes/${index}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to remove checkbox");
  }
  return { id };
};

// Custom store class that supports index-based access
class CheckboxOptimisticStore extends OptimisticStore<CheckboxUiData> {
  // Override get method to support index-based access
  getByIndex(index: number): CheckboxUiData | undefined {
    // Find checkbox by index in the list
    return this.list.find(checkbox => checkbox.index === index);
  }

  // Override upsert to ensure we can find by index
  upsertByIndex(checkbox: CheckboxUiData): void {
    this.upsert(checkbox);
  }
}

// Create the optimistic store hook
export const useCheckboxOptimisticStore = createOptimisticStore<CheckboxApiData, CheckboxUiData>({
  name: "checkboxes",
  queryFn: fetchCheckboxes,
  mutations: {
    create: createCheckbox,
    update: updateCheckbox,
    remove: removeCheckbox,
  },
  storeClass: CheckboxOptimisticStore,
});
