# Hooks Are Thin Bridges

Tags: `#hooks #react #effects #services #architecture`

## Rule: Hooks should wire effects and services, not become controller objects

Do not do this:

```ts
const controller = useBigController();
return <Layout controller={controller} />;
```

Where `useBigController()`:
- re-derives large amounts of domain state
- owns many unrelated handlers
- exposes refs, callbacks, state, and service objects in one return bag
- becomes the default API for an entire feature

Do this instead:

```ts
const hudStore = usePlayHUDStore();
const countdown = useRespawnCountdown(hudStore.respawnAllowedAt);
useTauntHotkeys({ hudStore, overlayStore });
const debugStats = useHudDebugStats(hudStore.showDebug, hudStore.gameSocket);
```

Why:
- Hooks are good at browser wiring: subscriptions, timers, DOM listeners, clipboard access, and service lifecycles.
- Hooks are not a good replacement for domain boundaries.
- If a hook returns "everything the feature might need", it becomes a controller bag that is hard to reason about and easy to grow forever.

Preferred pattern:
- Keep domain state in stores or pure selectors.
- Keep hooks focused on one concern.
- Return small, intention-revealing shapes.
- Compose multiple focused hooks at the feature boundary instead of building one giant controller hook.

Review smells:
- A hook return type spans dozens of fields.
- A hook exposes raw services and unrelated UI state together.
- Layout components depend on a single controller object for everything.
- A hook duplicates computed logic that should live in a store or selector.
