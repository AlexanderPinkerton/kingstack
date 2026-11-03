---
"@kingstack/config": patch
---

Use Vercel's named --environment option when syncing configuration. Explicitly mark valid Stripe publishable keys in NEXT_PUBLIC_ variables as public config for Vercel CLI 65. Keep private keys and unrelated values subject to Vercel's credential checks, with values sent through stdin.
