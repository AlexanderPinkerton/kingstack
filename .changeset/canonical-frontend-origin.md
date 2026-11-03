---
"@kingstack/deploy": patch
---

Reject redirect aliases when importing NEXT_HOST from Vercel, and offer only destination domains for automatic or interactive selection. This keeps frontend metadata, backend CORS, and Auth redirects on the same canonical origin.

Nest deployment also checks the configured frontend with a read-only, bounded HTTP request and warns when it redirects to another origin. Unavailable frontends remain advisory so first deployments can proceed.
