# AI assistant guide

Repository working instructions live in the root `AGENTS.md`. Keep them there
instead of duplicating operational rules in documentation that can drift.

Before changing an unfamiliar subsystem, read its current architecture guide:

- [Authentication](./auth/README.md)
- [Configuration](../config/readme.md)
- [State management](./state-management/README.md)
- [Logging and observability](./logging-and-observability.md)
- [Supabase management](./supabase/README.md)
- [Deployment](./deployment/README.md)

For frontend HTTP, use `fetchWithAuth` from
`@/lib/auth/authenticated-fetch` for protected requests and `fetchPublic` from
`@/lib/http/public-fetch` for deliberately public requests. Direct `fetch()`
calls fail the Next.js lint rule. Decode protected JSON with
`readJsonResponse` so non-2xx payloads cannot enter domain state as successful
data.
