# Typed Event Catalogs

Tags: `#typescript #analytics #events #shared-contracts #maintainability`

## Rule: Use a named event catalog and derive types from it

Do not do this:

```ts
type AnalyticsEventName =
  | "join_game_succeeded"
  | "join_game_failed"
  | "play_session_started";

analytics.capture("join_game_succeeded", userId);
```

Do this instead:

```ts
export const AnalyticsEvents = {
  JoinGameSucceeded: "join_game_succeeded",
  JoinGameFailed: "join_game_failed",
  PlaySessionStarted: "play_session_started",
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

analytics.capture(AnalyticsEvents.JoinGameSucceeded, userId);
```

Why:

- Event names are product contracts, not incidental strings.
- The runtime catalog gives call sites a single source of truth and makes rename/search reliable.
- The derived type keeps compile-time safety without maintaining a second list.
- Shared events should live in a shared package so client, server, tests, and dashboards agree on names.

Review smells:

- Large unions of string literals that duplicate a runtime list.
- Analytics, socket, message, queue, or job names passed as raw strings across module boundaries.
- Client and server defining separate copies of the same event names.
- Tests asserting event strings that do not come from the same catalog as production code.
