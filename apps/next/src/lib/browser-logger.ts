import { createBrowserLogger } from "@kingstack/logger/browser";

export const browserLogger = createBrowserLogger({
  level: process.env.NODE_ENV === "production" ? "warn" : "debug",
  bindings: {
    service: "next-browser",
    environment: process.env.NODE_ENV === "production" ? "production" : "local",
  },
});
