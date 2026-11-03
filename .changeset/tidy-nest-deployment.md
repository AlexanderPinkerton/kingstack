---
"@kingstack/deploy": minor
---

Resolve the Nest Dockerfile beside the schema's Nest envfile so projects with
renamed backend workspaces can deploy. Support NEST_HEALTHCHECK_PATH (default /)
and require a 2xx readiness response. Mark validation containers with
KINGSTACK_DEPLOYMENT_CANDIDATE=true so applications can disable scheduled jobs
until the active container starts.

Update the supported Vercel CLI range to >=65.10.0 <66 and the template tooling pin to 65.10.0.
