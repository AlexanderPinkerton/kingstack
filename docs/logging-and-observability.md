# Logging and observability architecture

Status: Phase 1 implemented
Last reviewed: 2026-08-01

## Decision summary

KingStack will introduce a dedicated `@kingstack/logger` package with a small,
runtime-neutral interface. Pino will provide structured server logging, while
NestJS and browser adapters will expose the same application-level conventions
in their respective runtimes.

The package follows the `@kingstack/config` model: a published engine that
generated projects install from npm, configured by project-owned files that
ship as template source. A KingStack user should never need to modify logger
source to change redaction rules, base fields, service names, or levels. Every
such decision is an input to the package, not a fork of it.

Production logs will be structured JSON written to standard output. Development
logs will be human-readable. Sensitive fields will be redacted by default, and
runtime log levels will be configurable without changing application code.

OpenTelemetry will complement this logger with distributed traces, metrics, and
cross-signal correlation. It will not become the primary API that application
code uses to write logs. Initial implementation will leave log output
vendor-neutral and will not require an observability backend or Collector.

## Why this change is needed

Runtime logging is currently split between raw `console.*` calls and NestJS's
built-in `Logger`. This causes several problems:

- log levels and output formats cannot be controlled consistently;
- messages contain prose instead of stable, queryable fields;
- errors are not serialized consistently;
- requests cannot reliably be followed across Next.js, NestJS, and data access;
- arbitrary objects can expose sessions, credentials, or personal data;
- tests cannot replace or capture logging cleanly; and
- changing log destinations would require edits throughout the applications.

Command-line presentation is a separate concern. Output from tools such as
`create-kingstack` is part of their user interface and should not be forced
through the application telemetry system.

The initial audit found roughly 26 runtime logging call sites across the two
applications after excluding application scripts and CLI presentation. The
implementation should remain proportional to that surface. The package boundary
is justified primarily because every generated KingStack project needs the same
safe defaults, not because the current applications need a large logging
framework.

## Goals

- Provide one application-level logging contract across KingStack runtimes.
- Produce structured, searchable production logs.
- Preserve pleasant local development output.
- Attach component, service, request, and later trace context consistently.
- Redact known sensitive fields before they leave the process.
- Make logging easy to silence or capture in tests.
- Keep the stack independent of any one telemetry vendor.
- Prepare logs for later correlation with OpenTelemetry traces.

## Non-goals

- Selecting or operating a hosted observability vendor in the first release.
- Replacing purpose-built CLI output with JSON logs.
- Sending routine browser logs to a server by default.
- Logging request or response bodies automatically.
- Treating logging as analytics or audit storage.
- Adopting the OpenTelemetry Logs API directly in application code.

## Signals and responsibilities

Logs, metrics, and traces answer different questions:

| Signal | Primary question | Example |
| --- | --- | --- |
| Logs | What happened? | A username update failed with a serialized error. |
| Metrics | How often or how slowly? | The p95 username-update latency exceeded 500 ms. |
| Traces | Where did one operation spend time? | A request spent most of its time in PostgreSQL. |

The logger owns application events and diagnostic records. OpenTelemetry owns
standardized trace and metric instrumentation, context propagation, and export.
An observability backend stores, searches, visualizes, and alerts on those
signals. OpenTelemetry itself is not that backend.

## Target architecture

```text
Application code
      │
      ▼
@kingstack/logger contract
      │
      ├── Node.js adapter ──► Pino ──► JSON stdout
      ├── NestJS adapter ───► Pino ──► JSON stdout
      ├── Browser adapter ──► controlled console output
      └── Test adapter ─────► silent or captured records

Next.js and NestJS instrumentation
      │
      ├── traces
      └── metrics
              │
              ▼
     OpenTelemetry export
              │
              ▼
  optional Collector and backend

Active trace context
      └── inject traceId/spanId into structured log records
```

The initial milestone ends at structured stdout. The OpenTelemetry path can be
added independently when KingStack has a production need for distributed
tracing, service-level metrics, or centralized export.

## Package boundary

The `packages/logger` workspace exposes runtime-specific entry
points so browser code cannot accidentally bundle Node.js dependencies:

```text
@kingstack/logger             Shared types and contracts
@kingstack/logger/node        Pino-backed Node.js logger
@kingstack/logger/browser     Browser-safe logger
@kingstack/logger/testing     No-op and record-capturing test loggers
```

NestJS integration lives in a thin `LoggingModule` inside `apps/nest`. It reuses
the package's configuration and field conventions rather than creating a
second logging system.

The package must not depend on React, Next.js, application stores, Prisma, or
domain modules.

These four entry points are the first subpath `exports` map among KingStack's
published packages. `@kingstack/advanced-optimistic-store`, `@kingstack/comment-tree`,
and `@kingstack/dnd-tree` each publish a single `"."` entry, and
`@kingstack/config` has no `exports` field at all. Build layout, type
resolution, and the browser/Node subpaths must therefore be
verified against a real `node_modules` consumer rather than a workspace
symlink, which resolves more permissively.

### Distribution

`@kingstack/logger` is published to npm and installed by generated projects, in
the same category as `@kingstack/config` and `@kingstack/advanced-optimistic-store`.
It is not projected into generated projects as source. In
`packages/create-kingstack/src/constants.ts` this means:

- add `"@kingstack/logger"` to `PUBLISHED_PACKAGES` with its npm version, which
  both exempts the name from namespace replacement and substitutes the npm
  version for `workspace:*` in each app's `package.json`;
- add `packages/logger` to `PACKAGES_TO_REMOVE`, consistent with the other
  published libraries; and
- make no change to `TEMPLATE_PATHS`. The projection is a deny-by-default
  allowlist, so an unlisted `packages/logger` is pruned automatically, while
  the per-application bootstrap files are already covered by the existing
  `apps` entry.

The generated project therefore receives `@kingstack/logger` from npm and keeps
its own logging policy in application source it owns.

### Project-owned configuration

The logger is the only runtime package shared by both applications for this
concern. Logging policy is still expressed per application rather than in a
second project-owned shared module:

```text
@kingstack/logger                 published engine, contract, adapters, defaults
apps/next/src/lib/logger.ts       project-owned: service name, extra redaction paths
apps/nest/src/logging.ts          project-owned: Nest, Fastify, and service policy
config/schema.ts                  project-owned: logging environment declarations
```

Each bootstrap file calls the package's factory with project inputs. The
package owns the default redaction list, the standard field set, and error
serialization; the application adds only what is specific to it. Duplication
between the two bootstrap files should stay limited to values that genuinely
differ, such as `service`.

This mirrors how `@kingstack/config` already works: the published package
provides `defineSchema` and validation, while `config/schema.ts` lives in the
generated project and holds the decisions.

## Application contract

The public contract should stay smaller than Pino's complete API. A proposed
shape is:

```ts
type LogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal"
  | "silent";

type LogScalar = string | number | boolean | null | undefined;
type LogValue = LogScalar | readonly LogScalar[];
type LogContext = Readonly<Record<string, LogValue>>;

interface AppLogger {
  trace(event: string, context?: LogContext): void;
  debug(event: string, context?: LogContext): void;
  info(event: string, context?: LogContext): void;
  warn(event: string, context?: LogContext): void;
  error(
    event: string,
    details?: { context?: LogContext; error?: unknown },
  ): void;
  fatal(
    event: string,
    details?: { context?: LogContext; error?: unknown },
  ): void;
  child(bindings: LogContext): AppLogger;
  isLevelEnabled(level: LogLevel): boolean;
}
```

This is a design target, not a frozen signature. Implementation work should
validate its ergonomics against Next.js route handlers, NestJS providers,
WebSocket handlers, scripts, and tests before making it public.

Context intentionally accepts only JSON-safe scalar values and arrays of
scalars. Callers cannot spread a request, session, store, user, or domain object
into a record without an explicit type escape. `isLevelEnabled` allows callers
to avoid expensive context construction for disabled levels.

Error and fatal details use a tagged object so throwable and context-only events
are both ergonomic while `logger.error("event", error)` remains a type error.
For example, use
`logger.error("post.create_failed", { context: { postId }, error })` or
`logger.error("realtime.channel_failed")`.

Because `LogContext` is an index-signature type, TypeScript will not accept a
value declared through a separate interface. Shared bindings should be typed as
`LogContext` directly:

```ts
const bindings: LogContext = { component: "RealtimeGateway", service: "nest" };
```

### Event naming

The first argument is a stable event name, not a complete prose sentence:

```ts
logger.info("checkbox.updated", { checkboxId });
logger.warn("realtime.subscription_delayed", { channel, durationMs });
logger.error("username.change_failed", { context: { userId }, error });
```

Event names use lowercase dot-separated identifiers. Human explanation belongs
in documentation or an optional `message` context field. Stable identifiers
allow dashboards and alerts to survive wording changes.

### Child loggers

Components bind stable context once rather than repeating it:

```ts
const logger = rootLogger.child({
  component: "RealtimeGateway",
  service: "nest",
});
```

Request-specific child loggers add request context. Domain operations may add
identifiers, but they must not bind complete domain objects.

## Standard record fields

Server records should use a consistent schema:

| Field | Purpose |
| --- | --- |
| `time` | Pino's default epoch-millisecond timestamp. |
| `level` | Trace, debug, info, warn, error, or fatal. |
| `event` | Stable dot-separated event name. |
| `service` | Producing runtime, such as `next` or `nest`. |
| `component` | Route, provider, gateway, store, or subsystem. |
| `environment` | Local, development, or production configuration target. |
| `version` | Release or commit identifier when available. |
| `requestId` | Incoming or generated request correlation ID. |
| `traceId` | Active OpenTelemetry trace ID when tracing is enabled. |
| `spanId` | Active OpenTelemetry span ID when tracing is enabled. |
| `err` | Serialized error name, message, stack, and safe cause data. |

Fields are included only when they have meaningful values. IDs such as
`userId`, `postId`, or `checkboxId` belong in event context rather than the
global base record.

KingStack will keep Pino's default numeric `time` value. ISO conversion belongs
in an ingestion or presentation layer if a chosen backend requires it; the
logger will not pay an ISO formatting cost for every record.

## Runtime behavior

### Server production

- Write newline-delimited structured JSON to standard output.
- Default to `info` and above.
- Keep Pino's default epoch-millisecond `time` field.
- Do not perform synchronous network delivery in the request path.
- Let the deployment platform or a later Collector ship records elsewhere.
- Preserve error stacks while applying redaction.

### Local development

- Default to `debug` and above.
- Use a pretty-print transport intended only for development.
- Keep routine pretty records on one line, promote component context beside the
  event name, and retain multiline error stacks.
- Hide repeated service and environment fields from pretty presentation only;
  preserve them in the underlying structured record and all JSON output.
- Keep the same fields and event names as production.
- Allow JSON output locally for debugging ingestion problems.
- Keep `pino-pretty` in application development dependencies and make the
  pretty-transport branch unreachable when running on Vercel or in a production
  runtime. Pino transports use worker threads and must not be initialized in a
  serverless function.

### Tests

- Default to `silent` for routine test runs.
- Provide an in-memory capturing logger for behavior that genuinely includes
  logging requirements.
- Do not mock first-party business behavior merely to avoid log output.

### Browser

- Use the same event names and levels through a browser-safe implementation.
- Compile out or suppress trace/debug output in production.
- Do not send browser records over the network in the initial milestone.
- Never log session objects, access tokens, cookies, authorization headers, or
  complete application stores.
- Later client error reporting must define sampling, consent, privacy, payload,
  and abuse controls before it is enabled.

### CLI tools

User-facing CLI messages, prompts, progress, tables, and command results remain
presentation output. A small `CliReporter` may centralize their formatting, but
it is intentionally separate from `AppLogger`.

Operational failures inside CLI tools may use the logger when machine-readable
diagnostics are valuable, provided this does not corrupt stdout contracts or
interactive output.

## Configuration

The initial environment contract should remain small:

| Variable | Meaning | Suggested default |
| --- | --- | --- |
| `LOG_LEVEL` | Minimum emitted level. | `debug` locally, `info` in production, `silent` in tests. |
| `LOG_FORMAT` | `pretty` or `json`. | `pretty` locally, `json` elsewhere. |
| `KINGSTACK_ENVIRONMENT` | `local`, `development`, or `production`. | Inferred from the runtime when omitted. |

`KINGSTACK_ENVIRONMENT` is also the configuration system's canonical deployment
classification: `local` generates localhost URLs, while `development` and
`production` generate hosted URLs. It replaces the older, coarser
`ENVIRONMENT_TYPE` switch.

KingStack's configuration package is a build-time generator, not the
applications' runtime configuration parser. Logging configuration therefore has
two explicit validation layers:

1. declare `LOG_LEVEL`, `LOG_FORMAT`, and `KINGSTACK_ENVIRONMENT` in
   `config/schema.ts` and add all three keys
   to the `next` and `nest` entries of its `envfiles` map, so the generator
   writes them into `apps/next/.env` and `apps/nest/.env`; and
2. parse and validate the resulting `process.env` values inside the logger at
   runtime, failing startup on invalid values rather than silently selecting an
   unexpected level or format.

Nest constructs its logger while application modules are imported, before
`ConfigModule.forRoot()` executes. Its logging bootstrap therefore loads
`apps/nest/.env` through `dotenv/config` before creating the Pino runtime.

All three keys must be declared with `default:`, never `required: true`.
`config/local.ts`, `config/development.ts`, and `config/production.ts` are
gitignored per-environment inputs that already exist in every checkout and
deployment. A required key with no default would break `king-config generate`
for every existing environment until someone hand-edits an untracked file. The
only tracked configuration deliverables for this work are `config/schema.ts`
and a documenting entry in `config/example.ts`.

The structured record's `environment` field uses those same three configuration
targets: `local`, `development`, or `production`. Preview deployments use the
development configuration target unless the configuration system later adds a
first-class preview target. Test behavior is selected by the test runtime and
does not add a fourth deployment target to production records.

`LOG_FORMAT=pretty` is invalid unless the resolved KingStack environment is
`local`, and it is always invalid when the Vercel runtime marker is present.
This must be enforced even if a remote environment is misconfigured; merely
defaulting to JSON is insufficient. Next initializes its logger lazily so a
local `next build` does not start the worker-thread pretty transport.

Destination credentials are deliberately absent until a destination has been
selected. Application code must never know exporter or vendor credentials.

## Request correlation

NestJS runs on `FastifyAdapter`. Fastify creates the canonical request ID through
its `requestIdHeader` and `genReqId` configuration. The resolver also writes the
ID onto the raw Node request before Nest middleware runs, allowing `pino-http`
to reuse that exact value rather than generate a second ID:

1. accept a syntactically valid `x-request-id` only from trusted infrastructure;
2. otherwise generate a collision-resistant ID instead of relying on Fastify's
   process-local incrementing fallback;
3. return the effective ID in the response;
4. bind the same ID to request-scoped application logs; and
5. propagate it across internal HTTP calls and relevant background work.

HTTP logging has exactly one owner. KingStack will keep Fastify's built-in Pino
logger disabled and let `nestjs-pino`/`pino-http` own automatic HTTP records,
Nest system logs, and AsyncLocalStorage request context. It will not enable a
second logger in `FastifyAdapter`, and it will not use `useExisting: true`.
Implementation tests must prove that Fastify's request ID, the response header,
and the ID bound by `pino-http` agree.

Automatic request completion records should capture method, route template,
status, and duration without capturing bodies, authorization headers, or raw
query strings.

Health and readiness routes may be suppressed or sampled to avoid noise.

Next.js server routes should use the Node.js adapter. Request helpers should
create a request child logger until a broader tracing context is introduced.
Client Components must import only the browser export.

### WebSocket correlation

Socket.IO handlers do not run inside the HTTP request context maintained by
`nestjs-pino`. They use connection-scoped context instead:

- bind the Socket.IO socket ID as `connectionId` during `handleConnection`;
- add an allow-listed `userId` only after authentication succeeds;
- use an event or operation ID when one message initiates asynchronous work; and
- never describe this context as an HTTP `requestId`.

Handshake request context may be recorded as a parent or link when useful, but
it does not remain the lifetime correlation identity for the socket.

## Error handling

Errors must be passed as errors, not interpolated into strings:

```ts
logger.error("post.create_failed", {
  context: { postId },
  error,
});
```

The adapter is responsible for normalizing `unknown`, preserving stacks for
real `Error` instances, following safe `cause` chains, and producing a useful
record for non-error throws. Application code should not duplicate serializers.

Expected validation and authorization failures are not automatically error
logs. Their level depends on whether operators need to act:

- routine invalid user input generally needs no log or a debug record;
- suspicious repeated authorization failures may be warnings or security
  events;
- unexpected infrastructure and programming failures are errors; and
- fatal is reserved for failures immediately preceding process termination.

An error or fatal event may be meaningful without a throwable, so the contract's
error argument is optional. The Pino adapter must use Pino's `fatal` method for
fatal events; current Pino synchronously flushes the destination for that call.

That guarantee applies to a direct destination and does not cross a worker
thread, so it does not hold when a transport such as `pino-pretty` is active.
This is acceptable only because production writes JSON straight to stdout with
no transport. Anyone later adding a production transport must revisit fatal
durability rather than assume it carried over. Graceful shutdown should flush
any active destination or transport before termination.

Confirm the status of the `pino.final` API against the Pino version actually
installed before relying on or avoiding it; this document does not assert it.

## Redaction and data policy

Redaction is a last line of defense, not permission to log arbitrary objects.
The default policy must cover common variants of:

- authorization headers and cookies;
- access, refresh, API, and service-role tokens;
- passwords, secrets, and private keys;
- session objects;
- request and response bodies; and
- provider credentials.

Call sites should allow-list scalar context fields instead of spreading
requests, users, sessions, database records, or application stores into a log.
Email addresses, IP addresses, usernames, and other personal data require an
explicit operational reason and should be omitted or transformed when possible.

Redaction tests must prove that nested secrets and error-associated context do
not escape. Logs are not an audit trail; security-sensitive audit requirements
need their own schema, retention, integrity, and access-control design.

## OpenTelemetry's role

OpenTelemetry provides standard instrumentation, context propagation, semantic
conventions, and export for multiple observability signals. It does not replace
Pino's efficient log creation or define KingStack's application event names.

The expected integration is:

1. instrument server operations with OpenTelemetry traces and metrics;
2. propagate trace context across Next.js, NestJS, database, and outbound calls;
3. inject active `traceId` and `spanId` values into Pino records;
4. optionally bridge or collect structured logs into the OpenTelemetry data
   model; and
5. export signals through OTLP directly or through an OpenTelemetry Collector.

This lets an operator move from an aggregate metric, to a representative trace,
to the exact logs emitted during that trace.

### Adoption timing

As of this review, OpenTelemetry JavaScript tracing and metrics are stable, the
JavaScript Logs SDK is in development, and browser instrumentation remains
experimental. Therefore:

- structured Pino logging should be implemented now;
- server tracing and metrics can be adopted independently when their operational
  value justifies the infrastructure;
- KingStack should not expose the OpenTelemetry Logs API to application code;
- a log bridge can be added later without changing application call sites; and
- browser tracing should wait for a defined product need and privacy policy.

Next.js already provides OpenTelemetry integration and framework spans. NestJS
can be instrumented through the OpenTelemetry Node SDK and supported framework
instrumentations. Exact packages and exporters should be selected during the
tracing milestone rather than being coupled to the logger package.

## Rollout plan

### Phase 1: end-to-end logger delivery

Deliver the package, both application integrations, browser cleanup, template
projection, and enforcement as one change. Internal sequencing and a temporarily
uninstallable generated projection are acceptable because KingStack currently
has no external template users. The usable release still publishes the logger
before publishing the generator version that references it.

The package is consumed inside this monorepo through `workspace:*` regardless
of publication, so the first publish is an additional step rather than a
different design. Sequencing it after the in-repo migration means the contract
is validated against real call sites before any external consumer pins a
version. The source template's install smoke test may fail between merge and
publication; that is an explicitly accepted development-time constraint, not a
second architecture.

Package and configuration:

- Add `packages/logger` with shared, Node.js, browser, and testing entry
  points, parameterized so that redaction paths, base fields, and service name
  are inputs rather than source edits.
- Keep Pino in the package's runtime dependencies. Expose `pino-pretty` as an
  optional peer and install it as an application development dependency only.
- Implement runtime configuration validation, standard fields, level checks,
  error serialization, redaction, and fatal/shutdown flushing.
- Declare all three logging environment values in `config/schema.ts` using
  `default:`, and add them to the `next` and `nest` `envfiles` key lists.
- Add unit tests for levels, child context, error and context-only error events,
  fatal behavior, and secret redaction.
- Verify the subpath `exports` map resolves correctly from a real
  `node_modules` install, not only through a workspace symlink.

Publication and template projection:

- Leave the package public (`private` unset or `false`) so
  `scripts/get-public-packages.ts` includes it in `build:release-packages`, and
  publish through the existing changeset release workflow.
- Add `"@kingstack/logger"` to `PUBLISHED_PACKAGES` with the published version
  and to `PACKAGES_TO_REMOVE`; leave `TEMPLATE_PATHS` unchanged.
- Add projection tests asserting that `@kingstack/logger` survives namespace
  replacement unrenamed, that `workspace:*` is rewritten to the npm version in
  both applications, and that the per-application bootstrap files ship.

NestJS and Fastify:

- Configure `nestjs-pino` once in the root module and route Nest bootstrap and
  system logs through it.
- Keep Fastify's built-in logger disabled so `nestjs-pino`/`pino-http` is the
  sole owner of HTTP records.
- Configure and verify one request-ID strategy across Fastify and `pino-http`.
- Emit safe HTTP completion records and suppress noisy health checks.
- Migrate runtime `console.*` calls and normalize existing service events.
- Give the Socket.IO gateway connection-scoped correlation rather than claiming
  HTTP request context survives for the socket lifetime.

Next.js and browser:

- Add the project-owned `apps/next/src/lib/logger.ts` and `apps/nest/src/logging.ts`
  bootstrap files and import from them rather than constructing loggers ad hoc.
- Use the Node.js entry point in route handlers and server utilities and the
  browser entry point in Client Components.
- Add request-scoped helpers and consistent route/component fields.
- Explicitly list `pino` and `pino-pretty` in
  `next.config.ts#serverExternalPackages` to document and pin the server-only
  boundary. Next.js 16.2 already auto-externalizes both packages, but the
  explicit configuration avoids relying on that framework-maintained list.
- Reject pretty output on Vercel and in production before any Pino transport is
  created.
- Replace useful browser diagnostics and remove temporary or unsafe object
  logging.
- Add application-runtime `no-console` rules through ESLint directory overrides,
  not inline disables. Keep `apps/nest/src/scripts`, `apps/next/scripts`,
  `packages/create-kingstack`, root `scripts`, and the logger's browser adapter
  explicitly outside or exempt from that rule.

Exit conditions:

- package tests, lint, typechecking, and application builds pass;
- pretty local records and production JSON records preserve the same event
  schema;
- Nest HTTP requests emit one completion record with one correlation ID;
- WebSocket records use connection context without pretending it is an HTTP
  request ID;
- Pino and its transport code remain outside browser and serverless bundles;
- runtime application source has no unapproved direct console usage;
- production browser builds suppress routine diagnostics; and
- after `@kingstack/logger` is published, the full `test:create-kingstack` smoke
  test produces a project that has no `packages/logger` directory, resolves
  `@kingstack/logger` from npm, installs successfully, and passes its typecheck
  and test verification; and
- no logging policy in the generated project requires editing package source.

### Phase 2: OpenTelemetry tracing and metrics

- Define the production questions, service objectives, and backend requirements
  before adding instrumentation.
- Register Next.js and NestJS server tracing.
- Propagate context across internal calls and relevant asynchronous work.
- Add a small number of low-cardinality service metrics.
- Inject trace and span IDs into logger records.
- Decide whether direct OTLP export or an OpenTelemetry Collector better fits
  the deployment topology.

Exit condition: an operator can follow one request across runtimes and connect
its trace to associated logs without vendor-specific application code.

### Phase 3: optional log export

- Re-evaluate the OpenTelemetry JavaScript Logs SDK maturity.
- Select a bridge, Collector receiver, or platform-native stdout ingestion path.
- Define retention, access, sampling, and cost controls.
- Verify export failures cannot block application requests.

Exit condition: production logs reach the selected backend reliably without
changing application logging calls.

## Testing and verification

Implementation should include:

- unit tests for every logger adapter;
- contract tests proving adapters agree on event names, levels, and context;
- redaction tests using representative nested credentials and sessions;
- error serialization tests for `Error`, `cause`, and non-error throws;
- NestJS integration tests for one HTTP record, aligned request IDs, safe fields,
  and separate WebSocket connection context;
- Next.js build verification preventing Node.js logger code from entering client
  or serverless bundles;
- test logger examples that assert meaningful domain events without mocking
  first-party business logic; and
- resolution tests loading each subpath entry point from an installed package
  rather than a workspace symlink;
- projection tests plus the full generated-project smoke test proving that
  `create-kingstack` prunes the logger source, preserves the `@kingstack/logger`
  name, substitutes the npm version, and produces a project that installs,
  typechecks, and tests correctly.

## Deferred decisions

The following choices should be made when production requirements are known:

- observability backend and retention period;
- direct export versus Collector deployment;
- trace sampling strategy and cost ceiling;
- service objectives and alert thresholds;
- whether browser errors are transmitted;
- whether any domain requires a dedicated audit trail; and
- whether project-owned logging policy eventually warrants a dedicated
  `config/logging.ts` declaration file rather than per-application bootstrap
  modules.

Publication is no longer among these. `@kingstack/logger` is published as part
of the first milestone; deferring it would create two generated-project shapes,
one carrying forked logger source and one installing from npm.

## References

- [Pino API](https://github.com/pinojs/pino/blob/main/docs/api.md)
- [NestJS logger documentation](https://docs.nestjs.com/techniques/logger)
- [nestjs-pino](https://github.com/iamolegga/nestjs-pino)
- [Fastify logging](https://fastify.dev/docs/latest/Reference/Logging/)
- [Fastify server and request-ID options](https://fastify.dev/docs/latest/Reference/Server/)
- [Next.js server external packages](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages)
- [Next.js OpenTelemetry guide](https://nextjs.org/docs/app/guides/open-telemetry)
- [OpenTelemetry signals](https://opentelemetry.io/docs/concepts/signals/)
- [OpenTelemetry logs](https://opentelemetry.io/docs/concepts/signals/logs/)
- [OpenTelemetry JavaScript status](https://opentelemetry.io/docs/languages/js/)
- [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/)
