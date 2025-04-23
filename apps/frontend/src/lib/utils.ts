import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fetchInternal(token: string, url: string, method: string, body?: unknown) {
  return fetch(url, {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token || 'xxx'}`
    },
    body: body ? JSON.stringify(body) : undefined
  })
}