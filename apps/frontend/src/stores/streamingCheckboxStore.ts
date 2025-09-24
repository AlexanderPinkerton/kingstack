import {
  createOptimisticStore,
  OptimisticStore,
  DataTransformer,
} from "@/lib/optimistic-store-pattern";
import { CheckboxApiData, CheckboxUiData } from "./types/checkbox";
import { experimental_streamedQuery as streamedQuery } from "@tanstack/react-query";

// Get the backend URL
const baseUrl =
  process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";

// Streaming function that yields data in chunks
async function* streamCheckboxes(totalItems: number, chunkSize: number = 1000) {
  let offset = 0;

  while (offset < totalItems) {
    const limit = Math.min(chunkSize, totalItems - offset);
    console.log(`Streaming checkboxes: ${offset} to ${offset + limit}`);

    const response = await fetch(
      `${baseUrl}/checkboxes?limit=${limit}&offset=${offset}`,
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch checkboxes at offset ${offset}`);
    }

    const data = await response.json();
    yield data;

    offset += limit;

    // Small delay to prevent overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// API functions (same as before)
const fetchCheckboxes = async (): Promise<CheckboxApiData[]> => {
  const response = await fetch(`${baseUrl}/checkboxes`);
  if (!response.ok) {
    throw new Error("Failed to fetch checkboxes");
  }
  return response.json();
};

const createCheckbox = async (data: {
  index: number;
  checked: boolean;
}): Promise<CheckboxApiData> => {
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

const updateCheckbox = async ({
  id,
  data,
}: {
  id: string;
  data: { index: number; checked: boolean };
}): Promise<CheckboxApiData> => {
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
  const index = parseInt(id);
  const response = await fetch(`${baseUrl}/checkboxes/${index}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to remove checkbox");
  }
  return { id };
};

// Transformer for API ↔ UI data conversion
const checkboxTransformer: DataTransformer<CheckboxApiData, CheckboxUiData> = {
  toUi: (apiData: CheckboxApiData): CheckboxUiData => ({
    id: apiData.id,
    index: apiData.index,
    checked: apiData.checked,
    created_at: new Date(apiData.created_at),
    updated_at: new Date(apiData.updated_at),
  }),
  toApi: (uiData: CheckboxUiData): CheckboxApiData => ({
    id: uiData.id,
    index: uiData.index,
    checked: uiData.checked,
    created_at: uiData.created_at.toISOString(),
    updated_at: uiData.updated_at.toISOString(),
  }),
  optimisticDefaults: {
    createOptimisticUiData: (data: {
      index: number;
      checked: boolean;
    }): CheckboxUiData => ({
      id: `temp-${Date.now()}-${data.index}`,
      index: data.index,
      checked: data.checked,
      created_at: new Date(),
      updated_at: new Date(),
    }),
  },
};

// Custom store class that supports index-based access
class StreamingCheckboxOptimisticStore extends OptimisticStore<CheckboxUiData> {
  getByIndex(index: number): CheckboxUiData | undefined {
    return this.list.find((checkbox) => checkbox.index === index);
  }

  upsertByIndex(checkbox: CheckboxUiData): void {
    this.upsert(checkbox);
  }
}

// Create streaming query options
export const createStreamingCheckboxQuery = (
  totalItems: number = 5000,
  chunkSize: number = 1000,
) => {
  return {
    queryKey: ["checkboxes-stream", totalItems, chunkSize],
    queryFn: streamedQuery({
      streamFn: () => streamCheckboxes(totalItems, chunkSize),
      refetchMode: "append" as const,
      initialValue: [] as CheckboxApiData[],
      reducer: (acc: CheckboxApiData[], chunk: CheckboxApiData[]) => [
        ...acc,
        ...chunk,
      ],
    }),
  };
};

// Create the optimistic store hook (using regular query for mutations)
export const useStreamingCheckboxOptimisticStore = createOptimisticStore<
  CheckboxApiData,
  CheckboxUiData
>({
  name: "streaming-checkboxes",
  queryFn: fetchCheckboxes, // This won't be used when we use streaming
  mutations: {
    create: createCheckbox,
    update: updateCheckbox,
    remove: removeCheckbox,
  },
  transformer: checkboxTransformer,
  storeClass: StreamingCheckboxOptimisticStore,
});
