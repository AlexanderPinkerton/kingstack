# Domain Stores, Not God Objects

Tags: `#state-management #mobx #architecture #hud #boundaries #controller`

## Rule: Prefer bounded domain stores over page-level stores or giant controller bags

Do not do this:

```ts
function GameHUDLayout({ store }: { store: PlayPageUIStore }) {
  const alive = store.localCycle?.alive;
  const showSettings = store.showSettings;
  const roomCode = store.lobbyInfo?.roomCode;
  const isAdmin = store.isAdmin;
}
```

```ts
const controller = useGameHUDController();
return <MobilePortraitGameLayout controller={controller} />;
```

Do this instead:

```ts
<PlayHUDStoreProvider value={playHudStore}>
  <PlayOverlayStoreProvider value={playOverlayStore}>
    <GameHUD />
  </PlayOverlayStoreProvider>
</PlayHUDStoreProvider>
```

```ts
const hudStore = usePlayHUDStore();
const overlayStore = usePlayOverlayStore();

if (overlayStore.anyModalOpen) return null;
return <KillFeed entries={hudStore.killFeedEntries} />;
```

```ts
const killerInfo = getKillerInfo(hudStore.hudState, hudStore.deathMode);
```

Why:
- MobX gives fine-grained reactivity, but broad store access still creates hidden dependencies.
- Page-level stores make ownership boundaries soft.
- Giant controller hooks create a second god object instead of real encapsulation.
- Narrow domain stores reduce overreach without forcing prop soup.

Preferred pattern:
- The page-level store may coordinate domains.
- Leaf components should depend on the narrowest domain store that matches their responsibility.
- Keep derived HUD logic in pure selectors or domain-level computed values.
- Use React local state only for ephemeral view concerns such as drafts, popovers, and temporary clipboard status.

Heuristic:
- Ask "what domain should this component know exists?"
- If the answer is "the whole page", the boundary is probably too high.

Review smells:
- A leaf component depends on a page-level store just because it is available.
- A hook returns a large mixed bag of observables, handlers, refs, and derived values.
- The same derivation exists in both a store and a hook.
- A reset method touches many unrelated fields.
