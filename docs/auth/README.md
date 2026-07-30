# 🔐 JWT Authentication Architecture

KingStack uses **explicit JWT token passing** instead of relying on cookies or localStorage magic. The same Supabase JWT token is used across Next.js, NestJS, and realtime connections.

## Token Flow

1. **Token Source**: JWT token comes from Supabase's `session.access_token`
   - Obtained via `supabase.auth.onAuthStateChange()` or `supabase.auth.getSession()`
   - Token is stored in memory in `RootStore.session` (not localStorage/cookies)

2. **Frontend (Next.js)**:
   - Token is passed to stores via `store.enable(token)`
   - All API calls use `fetchWithAuth(token, url, options)` which explicitly requires the token
   - Token is never automatically attached from cookies/localStorage
   - Next.js API routes (server-side) extract token from `Authorization` header and validate with Supabase

3. **Backend (NestJS)**:
   - Uses `SupabaseStrategy` (Passport JWT) to extract token from `Authorization: Bearer <token>` header
   - Validates token using `SUPA_JWT_SECRET` environment variable
   - Protected routes use `@UseGuards(JwtAuthGuard)` decorator

4. **Realtime (Socket.io)**:
   - Client sends token via `socket.emit("register", { token, browserId })`
   - Gateway verifies token using `jwtService.verify()` with `SUPA_JWT_SECRET`
   - Socket connection is rejected if token is invalid

## `fetchWithAuth` Utility

**Always use `fetchWithAuth` for internal API calls** - never use plain `fetch`:

```ts
import { fetchWithAuth } from "@/lib/utils";

// ✅ Correct: Explicitly pass token
const token = rootStore.session?.access_token;
const data = await fetchWithAuth(token, `${baseUrl}/api/endpoint`, {
  method: "POST",
  body: JSON.stringify(payload),
}).then(res => res.json());

// ❌ Wrong: Don't rely on automatic cookie/localStorage magic
const data = await fetch("/api/endpoint", { ... }); // Missing auth!
```

**Why explicit token passing?**
- ✅ Clear and explicit - you always know what token is being used
- ✅ No hidden cookie/localStorage dependencies
- ✅ Works seamlessly across SSR, client-side, and API routes
- ✅ Easy to debug and test
- ✅ Supports multiple sessions/tokens if needed

## Example: Store Implementation

```ts
export class AdvancedTodoStore {
  private authToken: string | null = null;

  enable(authToken: string) {
    this.authToken = authToken;
    // ... enable store
  }

  private apiQueryFn = async (): Promise<TodoApiData[]> => {
    const token = this.authToken || "";
    const baseUrl = process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000";
    return fetchWithAuth(token, `${baseUrl}/todos`).then((res) => res.json());
  };
}
```

## Example: Next.js API Route

```ts
// apps/next/src/app/api/user/route.ts
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const jwt = request.headers.get("Authorization")?.replace("Bearer ", "");
  const { data: userData } = await supabase.auth.getUser(jwt);
  
  if (!userData?.user?.id) {
    return Response.json("Unauthorized", { status: 401 });
  }
  // ... handle request
}
```

## Environment Variables

All services use the same JWT secret for validation:
```env
SUPA_JWT_SECRET=your-supabase-jwt-secret  # Used by NestJS and realtime gateway
```

## Supabase Auth User Projection

Supabase owns identities in `auth.users`; application-facing profile data lives
in `public.user`. The `on_auth_user_created` database trigger creates the
application record after signup.

The projection:

- reads email from `auth.users.email`;
- accepts username metadata only when it matches the application's username
  rules;
- generates a stable `user_<auth-id>` username when metadata is absent or
  invalid;
- initializes `previous_usernames` to an empty array;
- leaves phone-only Supabase Auth identities without an application user row,
  because the application user model requires an email; and
- preserves usernames changed in the application when a backfill encounters an
  existing user ID.

The migration is the source of truth for deployed databases. Maintenance
scripts use the generated `apps/nest/.env` direct database URL:

```bash
# Reinstall the current trigger definition
yarn supabase:auth:trigger:install

# Add or repair public.user records for existing auth users
yarn supabase:auth:backfill

# Remove the trigger when deliberately disabling the projection
yarn supabase:auth:trigger:remove
```

If the required fields in Prisma's `user` model change, update the trigger in a
new Prisma migration and keep the installer/backfill scripts aligned with it.
