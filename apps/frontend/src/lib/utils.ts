import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fetchInternal(
  token: string,
  url: string,
  method: string,
  body?: unknown,
) {
  return fetch(url, {
    method: method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token || "xxx"}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function fetchWithAuth(
  token: string,
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  if (!token) {
    throw new Error("No token provided");
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);

  // Only set Content-Type if there's a body and it's not already set
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Set default Accept if not already set
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
