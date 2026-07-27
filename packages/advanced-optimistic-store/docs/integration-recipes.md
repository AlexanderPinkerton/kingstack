# Integration recipes

AOS deliberately stops at the domain-store boundary. These recipes show how an
application can own sessions, feature demand, frameworks, validation, and
cross-store relationships without moving business logic into UI hooks.

## A domain store with session and demand

This wrapper keeps all query keys, authorization, API calls, and activation
rules in plain TypeScript:

```ts
import {
  createOptimisticStore,
  type ObservableUIData,
} from "@kingstack/advanced-optimistic-store";
import type { QueryClient } from "@tanstack/query-core";

interface Session {
  accessToken: string;
  userId: string;
}

interface ProjectApi {
  id: string;
  name: string;
}

type CreateProjectInput = { name: string };
type UpdateProjectInput = { name?: string };

export class ProjectsStore {
  private session: Session | null = null;
  private consumers = 0;
  private disposed = false;

  readonly state;

  constructor(queryClient: QueryClient) {
    this.state = createOptimisticStore<
      ProjectApi,
      ProjectApi,
      ObservableUIData<ProjectApi>,
      CreateProjectInput,
      UpdateProjectInput
    >(
      {
        name: "projects",
        queryKey: () => ["projects", this.session?.userId ?? "anonymous"],
        enabled: () =>
          !this.disposed && this.consumers > 0 && this.session !== null,
        queryFn: async () => {
          const response = await fetch("/api/projects", {
            headers: this.authHeaders,
          });
          if (!response.ok) throw new Error("Could not load projects");
          return response.json() as Promise<ProjectApi[]>;
        },
        mutations: {
          create: async (input) => {
            const response = await fetch("/api/projects", {
              method: "POST",
              headers: {
                ...this.authHeaders,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(input),
            });
            if (!response.ok) throw new Error("Could not create project");
            return response.json() as Promise<ProjectApi>;
          },
          update: async ({ id, data }) => {
            const response = await fetch(`/api/projects/${id}`, {
              method: "PATCH",
              headers: {
                ...this.authHeaders,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error("Could not update project");
            return response.json() as Promise<ProjectApi>;
          },
          remove: async (id) => {
            const response = await fetch(`/api/projects/${id}`, {
              method: "DELETE",
              headers: this.authHeaders,
            });
            if (!response.ok) throw new Error("Could not remove project");
            return { id };
          },
        },
      },
      queryClient,
    );
  }

  setSession(session: Session | null): void {
    this.session = session;
    this.state.updateOptions();
  }

  activate(): () => void {
    if (this.disposed) throw new Error("ProjectsStore is disposed");

    this.consumers += 1;
    if (this.consumers === 1) this.state.updateOptions();

    let released = false;
    return () => {
      if (released || this.disposed) return;
      released = true;
      this.consumers = Math.max(0, this.consumers - 1);
      if (this.consumers === 0) this.state.updateOptions();
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.consumers = 0;
    this.state.destroy();
  }

  private get authHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.session?.accessToken ?? ""}`,
    };
  }
}
```

Important properties of this pattern:

- construction does not fetch because demand and session are initially absent;
- session identity scopes the cache;
- the current token is read when each request runs;
- token refresh can reuse fresh data for the same user;
- multiple consumers cannot disable one another accidentally;
- disposal is explicit and idempotent.

## Thin React integration

React can own runtime and component lifetimes without owning domain behavior.

### Activation hook

```tsx
import { useEffect } from "react";

interface Activatable {
  activate(): () => void;
}

export function useStoreActivation(store: Activatable): void {
  useEffect(() => store.activate(), [store]);
}
```

### Component

```tsx
import { observer } from "mobx-react-lite";

export const ProjectsPage = observer(function ProjectsPage() {
  const root = useRootStore();
  const projects = root.projects;

  useStoreActivation(projects);

  if (projects.state.api.status.isLoading) {
    return <p>Loading…</p>;
  }

  return (
    <ul>
      {projects.state.ui.list.map((project) => (
        <li key={project.id}>{project.name}</li>
      ))}
    </ul>
  );
});
```

The hook maps mount/unmount to demand acquisition/release. It does not choose
query keys, call APIs, interpret sessions, or implement mutations.

### Provider ownership

Use stable state so React renders do not recreate the QueryClient or stores:

```tsx
import { createContext, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

class ApplicationRuntime {
  readonly projects: ProjectsStore;

  private mounts = 0;
  private disposalGeneration = 0;
  private disposed = false;

  constructor(queryClient: QueryClient) {
    this.projects = new ProjectsStore(queryClient);
  }

  mount(): () => void {
    if (this.disposed) {
      throw new Error("ApplicationRuntime is disposed");
    }

    this.mounts += 1;
    this.disposalGeneration += 1;

    let released = false;
    return () => {
      if (released || this.disposed) return;
      released = true;
      this.mounts = Math.max(0, this.mounts - 1);
      if (this.mounts !== 0) return;

      const generation = ++this.disposalGeneration;
      queueMicrotask(() => {
        if (
          !this.disposed &&
          this.mounts === 0 &&
          this.disposalGeneration === generation
        ) {
          this.dispose();
        }
      });
    };
  }

  private dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.projects.dispose();
  }
}

export const RuntimeContext = createContext<ApplicationRuntime | null>(null);

export function ApplicationProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());
  const [runtime] = useState(() => new ApplicationRuntime(queryClient));

  useEffect(() => runtime.mount(), [runtime]);

  return (
    <QueryClientProvider client={queryClient}>
      <RuntimeContext.Provider value={runtime}>
        {children}
      </RuntimeContext.Provider>
    </QueryClientProvider>
  );
}
```

The deferred, reference-counted `mount()` survives React Strict Mode's
development setup/cleanup/setup probe while still disposing the runtime after a
real unmount.

## Filters and pagination

Filters belong in query identity:

```ts
let page = 1;
let filters = {
  status: "open",
  ownerId: null as string | null,
};

const store = createOptimisticStore({
  name: "issues",
  queryKey: () => ["issues", page, filters],
  queryFn: () => fetchIssues({ page, ...filters }),
  // ...
});

function setPage(nextPage: number): void {
  page = nextPage;
  store.updateOptions();
}

function setFilters(nextFilters: typeof filters): void {
  filters = nextFilters;
  page = 1;
  store.updateOptions();
}
```

TanStack Query structurally hashes keys, so serializable key objects are
supported. Avoid mutable class instances, credentials, functions, or values
whose serialization does not represent the dataset.

AOS currently models each query result as a complete entity array. For infinite
queries or pages that must be merged into one long list, use an application
wrapper with an explicit merge policy or use TanStack's infinite-query
facilities directly.

## Runtime validation with Zod

AOS does not validate server data. Validation belongs at the IO boundary before
data reaches the cache:

```ts
import { z } from "zod";

const TodoApiSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
  created_at: z.string().datetime(),
});

const TodoListSchema = z.array(TodoApiSchema);
type TodoApi = z.infer<typeof TodoApiSchema>;

async function fetchTodos(): Promise<TodoApi[]> {
  const response = await fetch("/api/todos");
  if (!response.ok) throw new Error("Could not load todos");
  return TodoListSchema.parse(await response.json());
}
```

The transformer can then focus only on API-to-UI representation:

```ts
const transformer = {
  toUi: (todo: TodoApi) => ({
    ...todo,
    createdAt: new Date(todo.created_at),
  }),
  toApi: (todo: TodoUi): TodoApi => ({
    id: todo.id,
    title: todo.title,
    done: todo.done,
    created_at: todo.createdAt.toISOString(),
  }),
};
```

Validate mutation responses as well. Throwing a validation error rejects the
mutation and invokes normal operation-specific rollback.

## Custom UI projections

Extend `ObservableUIData` when a domain needs reusable computed selectors:

```ts
import {
  ObservableUIData,
  type DataTransformer,
} from "@kingstack/advanced-optimistic-store";
import { computed, makeObservable } from "mobx";

class TodoUiData extends ObservableUIData<TodoUi> {
  constructor(transformer?: DataTransformer<TodoApi, TodoUi>) {
    super(transformer);
    makeObservable(this, {
      open: computed,
      completed: computed,
    });
  }

  get open(): TodoUi[] {
    return this.list.filter((todo) => !todo.done);
  }

  get completed(): TodoUi[] {
    return this.list.filter((todo) => todo.done);
  }
}

const store = createOptimisticStore<
  TodoApi,
  TodoUi,
  TodoUiData,
  CreateTodoInput,
  UpdateTodoInput
>({
  // ...
  storeClass: TodoUiData,
});
```

Keep server synchronization in the optimistic store and domain-specific
derived state in the custom UI class.

## Cross-store relationships

Prefer one authoritative store per entity type and derive relationships by ID:

```ts
import { computed, makeObservable } from "mobx";

class BlogStore {
  constructor(
    readonly posts: PostsStore,
    readonly users: UsersStore,
  ) {
    makeObservable(this, {
      postsWithAuthors: computed,
    });
  }

  get postsWithAuthors() {
    return this.posts.state.ui.list.map((post) => ({
      post,
      author: this.users.state.ui.get(post.authorId) ?? null,
    }));
  }
}
```

Denormalize read-only display data when that matches the API response, but
avoid maintaining several writable copies of the same entity. Coordinated
multi-entity transactions and referential integrity remain application-level
business logic.

## Tests

Inject a fresh QueryClient into each test:

```ts
import { QueryClient } from "@tanstack/query-core";

function createTestClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}
```

Useful assertions include:

- no query call before activation;
- fresh cache reuse after reactivation;
- optimistic UI before a deferred mutation resolves;
- operation-specific rollback after rejection;
- correct cache entry after success;
- old-scope mutation completion does not touch new-scope UI;
- query observer count returns to zero after deactivation;
- remote changes preserve pending local optimistic intent;
- transport subscriptions are released when feature demand ends.

Always call `store.destroy()` in cleanup.

## SSR and multiple runtimes

Do not use `getGlobalQueryClient()` for request-specific server data. Create a
QueryClient and stores per request, then dispose them when the request runtime
ends.

AOS does not provide MobX serialization or hydration. If the framework
hydrates TanStack Query cache data, an enabled store will reconcile that cache
into its MobX projection when it subscribes. Application-specific UI-only state
requires its own serialization strategy.
