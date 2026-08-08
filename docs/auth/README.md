# KingStack authentication

KingStack uses Supabase Auth as the identity provider and explicit Bearer tokens
at every application service boundary. Cookies persist the browser session;
they do not silently authenticate calls to Next.js APIs, NestJS, or Socket.IO.

This separation is deliberate:

- Supabase owns login, refresh, logout, and token issuance.
- `RootStore` owns the current in-memory application session.
- Anonymous Supabase users are guest identities, not permanent accounts.
- Each protected HTTP request carries `Authorization: Bearer <access-token>`.
- Each authenticated Socket.IO connection registers its access token.
- Every server verifies the token before trusting its claims.

## End-to-end flow

```text
Supabase browser client
  cookies: access token + refresh token
                 │
          onAuthStateChange
                 │
        RootStore.session
           access_token
       ┌─────────┼──────────┐
       │         │          │
  Next.js API  NestJS   Socket.IO
    Bearer      Bearer   register(token)
       │         │          │
       └─────────┴──── getClaims() + claim validation
```

### Browser session persistence

`apps/next/src/lib/supabase/browserClient.ts` creates the singleton browser
client with `@supabase/ssr`. It persists the Supabase access and refresh tokens
in a project-specific cookie. The cookie name is derived from
`SUPABASE_PROJECT_REF`, which prevents local KingStack projects from sharing a
session accidentally.

The browser must be able to read these tokens so the Supabase client can
refresh the session. They are not `HttpOnly`; preventing cross-site scripting
is therefore part of the authentication security boundary.

`SessionManager` subscribes synchronously to `onAuthStateChange`. The initial
session, sign-in, token refresh, user update, and sign-out all travel through
that one subscription into `RootStore`. Domain stores always read the current
token when a request runs, while cache identity uses the stable user ID rather
than the rotating access token.

### Registration and confirmation redirects

KingStack's hosted default is immediate email/password signup. Supabase returns
a session from `signUp()`, the existing auth-state subscription publishes it,
and the login page redirects the authenticated user to `/app`.

Projects that require email ownership verification remain supported. Signup
sets `emailRedirectTo` to the current origin's `/login` route, where the
Supabase browser client can exchange the returned PKCE code. Do not use the
marketing home page as the confirmation callback; it does not initialize the
authenticated application runtime.

The hosted Supabase project must also know the deployment URL. After importing
`NEXT_HOST` from Vercel, run:

```bash
yarn supabase:auth:configure production
```

This sets the hosted Site URL and disables confirmation by default. Pass
`--require-email-confirmation` when verified email ownership is part of the
product's security model. It also enables anonymous sign-ins for one-click live
demos. Pass `--disable-anonymous-sign-ins` when a project should not offer guest
sessions.

Immediate signup is convenient for demos, but it allows accounts to claim
addresses they do not control. This example intentionally favors setup speed;
review confirmation and abuse controls before using the defaults at scale.

See Supabase's [redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls)
for the Site URL fallback and redirect allow-list behavior.

### HTTP requests from the browser

Protected requests must use the authenticated transport:

```ts
import {
  fetchWithAuth,
  readJsonResponse,
} from "@/lib/auth/authenticated-fetch";

const response = await fetchWithAuth(accessToken, "/api/example", {
  method: "POST",
  body: JSON.stringify(input),
});
const result = await readJsonResponse<ExampleResponse>(response);
```

`fetchWithAuth` refuses an empty token and is the only code that formats the
Bearer header. `readJsonResponse` throws `HttpResponseError` for every non-2xx
response, preserving the status without allowing an error payload to be
mistaken for successful domain data.

Deliberately public requests use `fetchPublic` from
`@/lib/http/public-fetch`. Direct `fetch()` calls are prohibited by the Next.js
ESLint configuration, so every request declares whether it is public or
authenticated. Do not make a protected endpoint depend on cookies being
attached implicitly.

KingStack does not automatically retry failed mutations after a `401`. An
automatic retry can duplicate a write whose response was interrupted. Surface
the authentication failure, refresh deliberately when appropriate, and retry
only operations whose idempotency is known.

### Next.js route handlers

Protected Next.js routes use the shared server helper:

```ts
const authentication = await authenticateBearerRequest(request);
if (!authentication.ok) {
  return bearerAuthenticationErrorResponse(authentication);
}

const userId = authentication.userId;
```

The helper strictly parses the Bearer scheme, calls
`supabase.auth.getClaims(accessToken)`, and accepts only a non-empty `sub` with
the `authenticated` audience. It uses a stateless Supabase client configured
with the publishable key; it does not read or write browser cookies.

Routes backed by persistent application data use
`authenticatePermanentBearerRequest`. It performs the same verification and
then returns `403` when the verified token has `is_anonymous: true`.

### NestJS HTTP

Nest controllers protect routes with `JwtAuthGuard`, `PermanentUserGuard`, or
`AdminGuard`.
`JwtAuthGuard` uses the same parser and claim validator as Next.js, then places
the verified claims on `request.user`. Authorization code must use this
verified value, never an unverified JWT decode. Persistent post and todo
endpoints use `PermanentUserGuard` so a guest token cannot mutate application
data.

The checkbox grid is explicitly demo state. Listing, bounded cell creation,
boolean toggles, and non-destructive bootstrap use `JwtAuthGuard`, so verified
guests can participate. Inputs are constrained to the fixed 200-cell grid and
guest mutations are rate-limited. Deletion and destructive reinitialization use
`PermanentUserGuard`.

### Socket.IO

The client connects, sends `register({ token, browserId })`, and waits for a
successful acknowledgment. Only then does it join rooms and restore presence.
The gateway verifies the token with the same `SupabaseTokenVerifier` used by
Nest HTTP.

When Supabase refreshes the access token, `RootStore` gives the new token to the
realtime manager. The manager replaces the authenticated connection and
restores rooms only after the new registration succeeds.

Unauthenticated realtime rooms use the separate `register_public` path. Every
namespace declares an explicit `access` level: `public`, `guest`, or
`permanent`. Guest and permanent rooms require a verified `userId`; permanent
rooms also reject tokens whose verified claims contain `is_anonymous: true`.

The live demo rooms are authenticated but guest-capable.
`signInAnonymously()` creates a temporary Supabase user, and the socket
registers its verified access token before joining the wave pool, canvas,
cursor, or checkbox namespace. Guests may publish validated presence and demo
signals, but may not reset the shared boat. Application-data namespaces still
require a permanent user.

### Guest sessions

The catalog, theme builder, and in-memory optimistic demo are public. The wave
pool, canvas, and collaborative checkbox pages display an explicit entry screen
rather than creating users on page load; their buttons call
`SessionManager.signInAnonymously()`. This keeps crawlers and casual page views
from creating Auth records. One guest session is reused across every live demo.

Supabase anonymous users have the `authenticated` audience and role, so the
`is_anonymous` claim is an authorization boundary everywhere data can persist.
`UserStoreManager` does not activate profile, post, or todo data for a guest. It
does provide the verified guest token to the bounded checkbox demo. A guest may
sign into an existing account normally. Starting a new registration discards
the temporary identity first because KingStack stores no guest-owned
application data.

Supabase does not automatically remove old anonymous users. Plan a periodic
cleanup policy before guest volume becomes material. See Supabase's
[anonymous sign-in guide](https://supabase.com/docs/guides/auth/auth-anonymous)
for access-control guidance and the cleanup query.

## Verification and signing keys

KingStack does not store Supabase's JWT signing secret. Next.js and NestJS call
`getClaims()` with the project URL and publishable key:

- asymmetric hosted tokens are verified against Supabase's cached JWKS;
- expiration and signature are verified by Supabase's client library;
- KingStack additionally requires the user subject and authenticated audience;
- compatible legacy/local symmetric tokens may require validation by the
  Supabase Auth server.

Local claim verification does not ask whether the user has logged out on
another device or whether the Auth server has revoked the session. A valid
access token can therefore remain usable until its short expiry. Use
`getUser(accessToken)` for a rare operation that specifically requires an
immediate Auth-server session check; ordinary KingStack APIs use normal JWT
semantics and `getClaims()`.

For hosted projects, use an asymmetric signing key and follow Supabase's
[signing-key rotation procedure](https://supabase.com/docs/guides/auth/signing-keys).
API-key migration is separate from user-token signing; see
[publishable and secret API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).

## Keys and environment variables

| Configuration input | Destination | Purpose |
| --- | --- | --- |
| `SUPABASE_PUBLISHABLE_KEY` | Next public config and Nest auth verifier | Identifies untrusted application clients; safe to expose |
| `SUPABASE_SECRET_KEY` | Nest only | Trusted Supabase Data API and realtime integration; never expose |
| `SUPABASE_API_URL` | Nest | Supabase project API/Auth URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and Next route handlers | Supabase project API/Auth URL |
| `NEXT_PUBLIC_SUPABASE_COOKIE_NAME` | Browser | Project-specific session cookie name |

The publishable and secret API keys do not sign user access tokens. Never add a
JWT signing secret, secret key, refresh token, or user access token to a
`NEXT_PUBLIC_*` variable.

After creating a hosted project, import the modern API key pair without copying
it through application logs:

```bash
yarn supabase:provision:get-secrets development \
  --project-ref <project-ref>
```

The importer rejects legacy `anon` and `service_role` keys and writes the
secret key only to the ignored `config/<environment>.ts` source of truth. See
the [hosted provisioning guide](../supabase/hosted-project-provisioning.md) for
password and pooler-region handling.

## Next.js Proxy and server-rendered auth

The current `apps/next/src/proxy.ts` adds request IDs to `/api/*`; it does not
authenticate users or refresh Supabase cookies. KingStack's authenticated pages
are client-driven, so no auth proxy is needed.

If a feature later requires authenticated Server Components, add Supabase's
documented Proxy refresh flow as a separate change. That proxy must call
`getClaims()`, copy refreshed cookies to both the request and response, apply
Supabase's private/no-store response headers, and avoid caching authenticated
responses. It maintains an SSR cookie session; it does not replace Bearer
authorization for Next APIs, NestJS, or realtime.

See Supabase's [Next.js SSR client guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs)
and [advanced SSR guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

## Authorization and cost controls

Authentication proves identity; authorization remains feature-specific:

- ordinary protected routes use the verified `sub` as the user ID;
- persistent application routes reject `is_anonymous: true` with `403`;
- admin routes verify the token and query the `admin_emails` allowlist;
- realtime namespaces decide whether unauthenticated, guest, or permanent
  registration is sufficient.

## Logging and operational rules

- Use HTTPS/WSS outside local development.
- Never log complete sessions, access tokens, refresh tokens, cookies, or
  Authorization headers.
- KingStack's Node logger redacts common token, cookie, secret, password, and
  authorization paths by default.
- Log request IDs, verified user IDs, auth event names, status codes, and token
  expiry timestamps when diagnosis needs more context.
- Treat `401` as missing, malformed, invalid, or expired authentication.
- Treat `403` as an authenticated identity lacking permission.
- Treat `429` as an authenticated caller exceeding a resource limit.

## Auth user projection

Supabase owns identities in `auth.users`; application profile data lives in
Prisma's `public.user`. The `on_auth_user_created` database trigger creates the
application row after signup and assigns a valid generated username when the
submitted metadata is absent or invalid.

The migration is the deployed source of truth. Maintenance commands are:

```bash
yarn supabase:auth:trigger:install
yarn supabase:auth:backfill
yarn supabase:auth:trigger:remove
```

When Prisma adds a required `user` field, update the trigger in the same schema
migration and keep the installer and backfill scripts aligned with it.

## Change checklist

When adding or changing an authenticated feature:

1. Decide explicitly whether the endpoint is public or protected.
2. Decide whether a protected endpoint accepts guests or requires a permanent
   account.
3. Use `fetchWithAuth` for protected requests or `fetchPublic` for public ones.
4. Verify the Bearer token at the first server boundary.
5. Authorize using verified claims and current application data.
6. Keep user ID—not the access token—in cache keys.
7. Define `401`, `403`, and `429` behavior.
8. Add tests for missing, malformed, invalid, expired, guest, and permanent
   tokens.
9. Confirm logs and error responses cannot expose credentials.
