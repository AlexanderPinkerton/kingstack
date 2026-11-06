---
"@kingstack/config": minor
"@kingstack/email": minor
"@kingstack/create-kingstack": patch
---

Add a Supabase Auth provider to the normal configuration sync workflow. Declared
SMTP, sender, URL, rate-limit, and verification settings are validated, applied
through the Management API, backed up privately, and verified without changing
email templates. Dry runs remain offline. TOML generation now supports existing
boolean and numeric settings as well as strings and ports.

Add `king-email auth templates` and `syncAuthTemplates` for publishing subjects
and HTML without changing delivery settings or account policy. Keep the previous
combined sync and verification commands available with deprecation guidance.

Generate new projects with config 0.5.x so they can declare Supabase Auth as a
normal hosted configuration target.
