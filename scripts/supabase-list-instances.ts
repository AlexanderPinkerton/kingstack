#!/usr/bin/env bun

import { spawnSync } from "child_process";

const PROJECT_LABEL = "com.supabase.cli.project";
const WORKDIR_LABEL = "com.supabase.cli.workdir";

export interface DockerContainerInspect {
  Name: string;
  Config: {
    Image: string;
    Labels?: Record<string, string> | null;
  };
  State: {
    Status: string;
    Running?: boolean;
    Health?: { Status: string };
  };
}

export interface DockerVolumeInspect {
  Name: string;
  Labels?: Record<string, string> | null;
}

export interface DockerImageSummary {
  Repository: string;
  Tag: string;
  Size: string;
}

export interface SupabaseContainer {
  service: string;
  image: string;
  state: string;
}

export interface SupabaseProject {
  projectId: string;
  workdir?: string;
  containers: SupabaseContainer[];
  volumes: string[];
}

export interface CachedSupabaseImage extends DockerImageSummary {
  inUseByRetainedContainer: boolean;
}

function projectLabel(
  labels: Record<string, string> | null | undefined,
): string | undefined {
  return labels?.[PROJECT_LABEL];
}

function resourceName(name: string, projectId: string): string {
  const normalized = name.replace(/^\//, "");
  const prefix = "supabase_";
  const suffix = `_${projectId}`;

  if (normalized.startsWith(prefix) && normalized.endsWith(suffix)) {
    return normalized.slice(prefix.length, -suffix.length);
  }

  return normalized;
}

export function buildSupabaseProjects(
  containers: DockerContainerInspect[],
  volumes: DockerVolumeInspect[],
): SupabaseProject[] {
  const projects = new Map<string, SupabaseProject>();

  function getProject(projectId: string): SupabaseProject {
    const existing = projects.get(projectId);
    if (existing) return existing;

    const project: SupabaseProject = {
      projectId,
      containers: [],
      volumes: [],
    };
    projects.set(projectId, project);
    return project;
  }

  for (const container of containers) {
    const projectId = projectLabel(container.Config.Labels);
    if (!projectId) continue;

    const project = getProject(projectId);
    project.workdir ??= container.Config.Labels?.[WORKDIR_LABEL];
    project.containers.push({
      service: resourceName(container.Name, projectId),
      image: container.Config.Image,
      state: container.State.Health?.Status ?? container.State.Status,
    });
  }

  for (const volume of volumes) {
    const projectId = projectLabel(volume.Labels);
    if (!projectId) continue;
    getProject(projectId).volumes.push(resourceName(volume.Name, projectId));
  }

  for (const project of projects.values()) {
    project.containers.sort((left, right) => {
      if (left.service === "db") return -1;
      if (right.service === "db") return 1;
      return left.service.localeCompare(right.service);
    });
    project.volumes.sort();
  }

  return [...projects.values()].sort((left, right) =>
    left.projectId.localeCompare(right.projectId),
  );
}

function isSupabaseRepository(repository: string): boolean {
  return (
    repository.startsWith("supabase/") || repository.includes("/supabase/")
  );
}

export function buildCachedSupabaseImages(
  images: DockerImageSummary[],
  containers: DockerContainerInspect[],
): CachedSupabaseImage[] {
  const retainedContainerImages = new Set(
    containers.map((container) => container.Config.Image),
  );

  return images
    .filter(
      (image) =>
        image.Tag !== "<none>" && isSupabaseRepository(image.Repository),
    )
    .map((image) => ({
      ...image,
      inUseByRetainedContainer: retainedContainerImages.has(
        `${image.Repository}:${image.Tag}`,
      ),
    }))
    .sort((left, right) =>
      `${left.Repository}:${left.Tag}`.localeCompare(
        `${right.Repository}:${right.Tag}`,
      ),
    );
}

function projectState(project: SupabaseProject): string {
  if (project.containers.length === 0) return "volumes only";
  const states = new Set(
    project.containers.map((container) => container.state),
  );
  if (
    [...states].every((state) => state === "healthy" || state === "running")
  ) {
    return "running";
  }
  return states.size === 1 ? [...states][0] : "mixed";
}

function shortImage(image: string): string {
  return image.replace(/^public\.ecr\.aws\/supabase\//, "");
}

export function renderSurvey(
  projects: SupabaseProject[],
  images: CachedSupabaseImage[],
): string {
  const lines = [
    "Supabase Docker survey",
    "Docker records exact container image tags, not the CLI version that created a volume.",
  ];

  if (projects.length === 0) {
    lines.push("", "No Supabase-labeled containers or volumes were found.");
  } else {
    lines.push("", "Projects");
    for (const project of projects) {
      lines.push("", `${project.projectId} (${projectState(project)})`);
      if (project.workdir) lines.push(`  workdir: ${project.workdir}`);

      if (project.containers.length === 0) {
        lines.push(
          "  images: unknown; `supabase stop` removed the containers that held that mapping",
        );
      } else {
        for (const container of project.containers) {
          lines.push(
            `  ${container.service.padEnd(12)} ${shortImage(container.image)} (${container.state})`,
          );
        }
      }

      if (project.volumes.length > 0) {
        lines.push(`  volumes: ${project.volumes.join(", ")}`);
      }
    }
  }

  lines.push(
    "",
    "Cached Supabase images",
    "Reported sizes may share layers; use `yarn docker:disk-usage` for reclaimable totals.",
  );
  if (images.length === 0) {
    lines.push("  none");
  } else {
    for (const image of images) {
      const usage = image.inUseByRetainedContainer
        ? "retained container"
        : "no retained container";
      lines.push(
        `  ${shortImage(`${image.Repository}:${image.Tag}`)} ${image.Size} (${usage})`,
      );
    }
  }

  lines.push(
    "",
    "A volume-only project may still need any cached generation, so verify it from that repository before removing images.",
  );
  return lines.join("\n");
}

function runDocker(args: string[]): string {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `docker ${args[0]} failed`);
  }
  return result.stdout.trim();
}

function lines(value: string): string[] {
  return value ? value.split("\n").filter(Boolean) : [];
}

function inspect<T>(kind: "container" | "volume", names: string[]): T[] {
  if (names.length === 0) return [];
  return JSON.parse(runDocker([kind, "inspect", ...names])) as T[];
}

function readImageSummaries(): DockerImageSummary[] {
  return lines(runDocker(["image", "ls", "--format", "{{json .}}"])).map(
    (line) => JSON.parse(line) as DockerImageSummary,
  );
}

function main(): void {
  try {
    const containerIds = lines(
      runDocker([
        "ps",
        "-a",
        "--filter",
        `label=${PROJECT_LABEL}`,
        "--format",
        "{{.ID}}",
      ]),
    );
    const volumeNames = lines(
      runDocker([
        "volume",
        "ls",
        "--filter",
        `label=${PROJECT_LABEL}`,
        "--format",
        "{{.Name}}",
      ]),
    );
    const containers = inspect<DockerContainerInspect>(
      "container",
      containerIds,
    );
    const volumes = inspect<DockerVolumeInspect>("volume", volumeNames);
    const projects = buildSupabaseProjects(containers, volumes);
    const images = buildCachedSupabaseImages(readImageSummaries(), containers);

    console.log(renderSurvey(projects, images));
  } catch (error) {
    console.error(
      `Unable to survey Supabase Docker state: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

if (import.meta.main) main();
