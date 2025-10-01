import { isPlaygroundMode } from '@kingstack/shapes';

// Utility function to get the appropriate query function based on mode
export function createQueryFn<T>(
  apiQueryFn: () => Promise<T[]>,
  mockQueryFn: () => Promise<T[]>
): () => Promise<T[]> {
  return () => {
    if (isPlaygroundMode()) {
      return mockQueryFn();
    }
    return apiQueryFn();
  };
}

// Utility function to get the appropriate mutation function based on mode
export function createMutationFn<T, R>(
  apiMutationFn: (data: T) => Promise<R>,
  mockMutationFn: (data: T) => Promise<R>
): (data: T) => Promise<R> {
  return (data: T) => {
    if (isPlaygroundMode()) {
      return mockMutationFn(data);
    }
    return apiMutationFn(data);
  };
}

// Utility function to get the appropriate update mutation function based on mode
export function createUpdateMutationFn<T, R>(
  apiMutationFn: (id: string, data: T) => Promise<R>,
  mockMutationFn: (id: string, data: T) => Promise<R>
): (id: string, data: T) => Promise<R> {
  return (id: string, data: T) => {
    if (isPlaygroundMode()) {
      return mockMutationFn(id, data);
    }
    return apiMutationFn(id, data);
  };
}

// Utility function to get the appropriate delete mutation function based on mode
export function createDeleteMutationFn<R>(
  apiMutationFn: (id: string) => Promise<R>,
  mockMutationFn: (id: string) => Promise<R>
): (id: string) => Promise<R> {
  return (id: string) => {
    if (isPlaygroundMode()) {
      return mockMutationFn(id);
    }
    return apiMutationFn(id);
  };
}
