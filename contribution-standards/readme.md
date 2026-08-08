# Contribution Standards

This folder holds focused design-pattern guidance for the repo.

How to use this folder:

- Start here.
- Do not load every standard by default.
- Use `ls contribution-standards` as the lightweight index.
- Use `rg` over tags or keywords to discover the relevant files for the task.
- Open only the files that match the concept you are working on.

Common cases:

- If the task involves MobX + React interactions, read `MobX Reactivity.md`.
- If the task involves store splits, controller hooks, view models, or state ownership, read `Domain Stores, Not God Objects.md`.
- If the task involves custom hooks or effect wiring, read `Hooks Are Thin Bridges.md`.
- If the task involves component placement, feature-folder ownership, or UI tree cleanup, read `Feature UI Trees, Not Junk Drawers.md`.
- If the task involves analytics events, socket events, queue names, or other cross-module event contracts, read `Typed Event Catalogs.md`.
- If the task involves ad links, UTM parameters, campaign dashboards, or marketing attribution, read `Marketing Attribution.md`.

Standard file format:

- Each standard should have a small set of hashtag tags near the top.
- Tags should reflect concepts, not individual tickets or one-off incidents.
- Prefer adding a new file only when the idea is reusable across the codebase.
- See `contribution-standards/Standard Format.md` for the expected structure and tag conventions.

Suggested discovery commands:

```bash
ls contribution-standards
rg -n "#mobx|#reactivity|#state-management" contribution-standards
rg -n "#hooks|#effects|#services" contribution-standards
rg -n "controller|view model|god object|selectors" contribution-standards
rg -n "#ui|#components|#ownership|#folders" contribution-standards
rg -n "#events|#analytics|#shared-contracts" contribution-standards
rg -n "#attribution|#utm|#marketing|#dashboards" contribution-standards
```
