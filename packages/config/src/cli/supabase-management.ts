import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Use the CLI login without putting its token in arguments, logs, or the repo. */
export function supabaseManagementToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN)
    return process.env.SUPABASE_ACCESS_TOKEN;
  if (process.platform === "darwin") {
    for (const account of ["supabase", "access-token"]) {
      try {
        let token = execFileSync(
          "/usr/bin/security",
          ["find-generic-password", "-s", "Supabase CLI", "-a", account, "-w"],
          {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
          },
        ).trim();
        // The Supabase CLI uses go-keyring's encoded credential format on macOS.
        for (const [prefix, encoding] of [
          ["go-keyring-encoded:", "hex"],
          ["go-keyring-base64:", "base64"],
        ] as const)
          if (token.startsWith(prefix))
            token = Buffer.from(
              token.slice(prefix.length),
              encoding,
            ).toString();
        if (token.startsWith("sbp_")) return token;
      } catch {
        /* Try the CLI's legacy credential location next. */
      }
    }
  }
  try {
    const token = readFileSync(
      join(homedir(), ".supabase", "access-token"),
      "utf8",
    ).trim();
    if (token.startsWith("sbp_")) return token;
  } catch {
    /* Report the actionable login step without credential errors. */
  }
  throw new Error(
    "Run yarn supabase login or supply SUPABASE_ACCESS_TOKEN to sync hosted Auth settings. Supabase uses its Management API, not application environment variables.",
  );
}

export async function authManagementRequest(
  project: string,
  token: string,
  patch?: Record<string, unknown>,
) {
  if (!/^[a-z0-9]{20}$/.test(project))
    throw new Error("Invalid Supabase project reference.");
  let response: Response;
  try {
    response = await fetch(
      `https://api.supabase.com/v1/projects/${project}/config/auth`,
      {
        method: patch ? "PATCH" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(patch ? { body: JSON.stringify(patch) } : {}),
        signal: AbortSignal.timeout(30_000),
      },
    );
  } catch {
    throw new Error("Supabase Management API could not be reached.");
  }
  if (!response.ok)
    throw new Error(
      `Supabase Auth configuration ${patch ? "update" : "read"} failed (HTTP ${response.status}).`,
    );
  return response.json() as Promise<Record<string, unknown>>;
}
