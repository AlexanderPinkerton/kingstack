# @kingstack/logger

Structured logging primitives for KingStack applications.

The package exposes separate entry points for shared types, Node.js/Pino,
browser-safe logging, and tests:

```ts
import type { AppLogger } from "@kingstack/logger";
import { createNodeLogger } from "@kingstack/logger/node";
import { createBrowserLogger } from "@kingstack/logger/browser";
import { createCapturingLogger } from "@kingstack/logger/testing";
```

Applications own service names, environment values, and extra redaction paths.
The package owns the structured event contract, safe defaults, error
serialization, and runtime adapters.

```ts
const runtime = createNodeLogger({
  service: "worker",
  environment: "production",
  level: process.env.LOG_LEVEL,
  format: process.env.LOG_FORMAT,
});

const logger = runtime.logger.child({ component: "InvoiceWorker" });
logger.info("invoice.processing_started", { invoiceId: "inv_123" });
logger.error("invoice.processing_failed", {
  context: { invoiceId: "inv_123" },
  error: new Error("Database unavailable"),
});
```

Context values are deliberately limited to scalars and scalar arrays. Pass
errors through the tagged `error` field so Pino preserves their stack, and call
`runtime.flush()` during graceful shutdown.
