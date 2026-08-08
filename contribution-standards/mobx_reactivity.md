# MobX Reactivity

Tags: `#mobx #reactivity #hooks #state-management`

## Rule: Never mirror MobX store state into React refs

Do not do this:

```ts
const showSettingsRef = useRef(false);
useEffect(() => {
  showSettingsRef.current = store.showSettings;
}, [store.showSettings]);

if (showSettingsRef.current) return;
```

Do this instead:

```ts
if (store.showSettings) return;
```

Why:
- MobX stores are mutable singletons.
- `store.someProperty` always gives the current value, even inside timers, event listeners, and async callbacks.
- Mirroring store state into refs adds duplication and drift without solving a real stale-closure problem.

Review smells:
- `useRef` that shadows observable store state.
- `useEffect` whose only job is copying observable values into refs.
- React state or refs being used as a second source of truth for MobX state.
