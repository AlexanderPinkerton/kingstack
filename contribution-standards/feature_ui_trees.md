# Feature UI Trees, Not Junk Drawers

Tags: `#architecture #ui #components #ownership #folders`

## Rule: Organize UI files by feature ownership, not by nearby convenience

Do not do this:

```text
components/game/layouts/
  DesktopGameLayout.tsx
  MobilePortraitGameLayout.tsx
  useHUDCameraMode.ts
  useRespawnCountdown.ts
  gameHUDTypes.ts
  NetcodeTimelineOverlay.tsx
  SettingsModal.tsx
```

Do this instead:

```text
components/game/
  screens/
  hud/
    layouts/
    components/
    hooks/
    shared/
  overlays/
  modals/
  customization/
  canvas/
  controls/
  admin/
  highlights/
```

Ownership rules:
- `screens/` own route-level or mode-level orchestration surfaces.
- `hud/layouts/` contains actual layout components only.
- `hud/components/` contains HUD widgets.
- `hud/hooks/` contains HUD-only browser wiring hooks.
- `hud/shared/` contains HUD-local types, constants, and render helpers.
- `overlays/` contains non-modal in-game overlays.
- `modals/` contains dialog-style UI.

Why:
- Folder ownership stays obvious when the feature grows.
- Hooks, types, and helpers stop accreting in generic buckets like `layouts/` or `shared/`.
- Reviews get simpler because file placement signals responsibility.
- Moving or deleting a surface stops requiring a scavenger hunt across unrelated folders.

Review smells:
- A folder named `layouts`, `shared`, or `components` contains a mix of hooks, overlays, modals, and helper types.
- New files are placed "near where they are used" instead of under the bounded feature that owns them.
- A layout folder contains logic files that are not render layouts.
- A top-level feature tree mixes screens, widgets, overlays, and modal dialogs flat in one directory.
