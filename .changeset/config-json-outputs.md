---
"@kingstack/config": minor
"@kingstack/create-kingstack": patch
---

Add JSON config outputs with environment selection, optional creation, preserved unmapped fields, validation before writes, and redacted drift checks. Generated KingStack projects link Vercel when generating a hosted environment. Local and playground generation leave that link alone.

Preserve Vercel link metadata during secret sync and verify that dry runs never create or change a link. Support explicitly optional service keys without weakening required-secret checks. Preserve indexed TOML array mappings and their comments when upgrading older consumers.

Keep the installed Vercel CLI 49 positional environment argument compatible alongside CLI 65's named environment and public-key flags.

Generated projects require config ^0.4.0 for the JSON mapping; publish that config release before releasing the updated project creator.
