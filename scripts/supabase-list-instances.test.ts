import { describe, expect, it } from "bun:test";
import {
  buildCachedSupabaseImages,
  buildSupabaseProjects,
  renderSurvey,
  type DockerContainerInspect,
} from "./supabase-list-instances.js";

const containers: DockerContainerInspect[] = [
  {
    Name: "/supabase_db_kingstack-local",
    Config: {
      Image: "public.ecr.aws/supabase/postgres:17.6.1.158",
      Labels: {
        "com.supabase.cli.project": "kingstack-local",
        "com.supabase.cli.workdir": "/code/kingstack",
      },
    },
    State: { Status: "running", Running: true, Health: { Status: "healthy" } },
  },
  {
    Name: "/supabase_auth_kingstack-local",
    Config: {
      Image: "public.ecr.aws/supabase/gotrue:v2.195.0",
      Labels: { "com.supabase.cli.project": "kingstack-local" },
    },
    State: { Status: "running", Running: true, Health: { Status: "healthy" } },
  },
];

describe("Supabase Docker survey", () => {
  it("groups retained containers and volume-only projects without guessing versions", () => {
    const projects = buildSupabaseProjects(containers, [
      {
        Name: "supabase_db_kingstack-local",
        Labels: { "com.supabase.cli.project": "kingstack-local" },
      },
      {
        Name: "supabase_db_moneytree-local",
        Labels: { "com.supabase.cli.project": "moneytree-local" },
      },
    ]);

    expect(projects).toHaveLength(2);
    expect(projects[0]).toMatchObject({
      projectId: "kingstack-local",
      workdir: "/code/kingstack",
      volumes: ["db"],
    });
    expect(
      projects[0]?.containers.map((container) => container.service),
    ).toEqual(["db", "auth"]);
    expect(projects[1]).toMatchObject({
      projectId: "moneytree-local",
      containers: [],
      volumes: ["db"],
    });

    const output = renderSurvey(projects, []);
    expect(output).toContain("kingstack-local (running)");
    expect(output).toContain("postgres:17.6.1.158");
    expect(output).toContain("moneytree-local (volumes only)");
    expect(output).toContain("images: unknown");
  });

  it("lists only tagged Supabase images and marks retained-container usage", () => {
    const images = buildCachedSupabaseImages(
      [
        {
          Repository: "public.ecr.aws/supabase/postgres",
          Tag: "17.6.1.158",
          Size: "4GB",
        },
        {
          Repository: "public.ecr.aws/supabase/postgres",
          Tag: "<none>",
          Size: "4GB",
        },
        { Repository: "kingstack-next", Tag: "latest", Size: "1GB" },
      ],
      containers,
    );

    expect(images).toEqual([
      {
        Repository: "public.ecr.aws/supabase/postgres",
        Tag: "17.6.1.158",
        Size: "4GB",
        inUseByRetainedContainer: true,
      },
    ]);
  });
});
