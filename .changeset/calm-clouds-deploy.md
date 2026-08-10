---
"@kingstack/config": minor
"@kingstack/create-kingstack": minor
"@kingstack/deploy": minor
---

Extract the hosted DigitalOcean, Supabase, and Vercel deployment commands into
the versioned `@kingstack/deploy` package. Generated projects now pin the
deployment CLI instead of receiving copied deployment source, while
`@kingstack/config` exposes the supported project-loading and safe environment
update APIs used by the package.
