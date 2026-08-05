import { describe, expect, it } from "bun:test";
import { parseSupabaseConfig } from "./supabase-check-config.js";

describe("Supabase config parsing", () => {
  it("reads TOML integers containing digit separators", () => {
    const config = parseSupabaseConfig(`
project_id = "test-project"

[api]
port = 10_003

[db]
port = 10_004
shadow_port = 10_002

  [db.pooler]
  port = 10_004

[studio]
port = 10_005
`);

    expect(config).toEqual({
      projectId: "test-project",
      apiPort: 10003,
      dbPort: 10004,
      studioPort: 10005,
      shadowPort: 10002,
    });
  });
});
