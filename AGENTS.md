# KingStack Agent Guidance

## Local Supabase status

The local Supabase stack runs in Docker. Managed agent sandboxes may block both
the Docker socket and connections to host-local ports even while the stack is
healthy.

- Use `yarn supabase:status` as the repository status helper.
- A Docker socket `permission denied` or `operation not permitted` error means
  the status is **unknown**, not stopped.
- When that happens, rerun `yarn supabase status` with permission to access the
  host Docker socket. If permission is unavailable, ask the user to run it.
- Only report the stack as stopped when the Supabase CLI explicitly says the
  local development setup is not running.
- `Stopped services: [...]` can list optional services. If the same output says
  `supabase local development setup is running`, the stack is running.

Do not skip database validation based on a sandbox permission error.
