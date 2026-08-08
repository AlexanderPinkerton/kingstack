# Standard Format

Tags: `#standards #documentation #tags #process`

## Rule: Keep standards easy to discover, cheap to maintain, and broad enough to reuse

Each standard file should follow this shape:

```md
# Title

Tags: `#tag-one #tag-two #tag-three`

## Rule: Short memorable rule

Do not do this:

```ts
// bad example
```

Do this instead:

```ts
// preferred example
```

Why:
- short reason
- short reason

Review smells:
- smell
- smell
```

Tag rules:
- Put tags near the top in a single `Tags:` line.
- Use hashtags for concepts, not files, features, or ticket numbers.
- Prefer broad reusable concepts such as `#mobx`, `#hooks`, `#state-management`, `#effects`, `#architecture`.
- Keep the tag set small. Usually `3-6` tags is enough.
- Reuse existing tags when possible before inventing new ones.

When to create a new standard:
- The guidance applies across multiple parts of the codebase.
- The rule affects architecture, state ownership, reactivity, effects, or maintainability.
- The same feedback is likely to come up again in code review.

When not to create a new standard:
- The guidance is specific to one ticket or one temporary migration.
- The rule can be folded into an existing standard without making it bloated.
- The pattern is still speculative and not yet stable.

Naming rules:
- Use descriptive filenames in Title Case.
- Name files after the concept or rule, not a specific incident.
- Prefer names that are grep-friendly and understandable in an `ls` listing.

Examples:
- `MobX Reactivity.md`
- `Hooks Are Thin Bridges.md`
- `Domain Stores, Not God Objects.md`
