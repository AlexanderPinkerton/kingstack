---
"@kingstack/create-kingstack": minor
---

Add frontend-draft and full-stack setup choices so generated projects can start
without Docker or Supabase while retaining the complete stack for later. Add
local-working-tree and no-start controls plus a root clean-room verification
helper for pre-release smoke testing. Automatically allocate and reserve a
complete local-service port block for each generated project, and add a guided
`yarn backend:enable` command for promoting drafts to the complete local stack.
Keep the unused Supabase Edge Runtime disabled until a project adds Edge
Functions, avoiding an unnecessary startup dependency.
