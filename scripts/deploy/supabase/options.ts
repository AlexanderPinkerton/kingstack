export interface CliOptions {
  projectName?: string;
  orgId?: string;
  region?: string;
  size?: ComputeSizeSlug;
  dryRun: boolean;
  yes: boolean;
  help: boolean;
}

export interface ProvisionPlan {
  projectName: string;
  orgId: string;
  region: string;
  size?: ComputeSizeSlug;
}

export interface RegionOption {
  id: string;
  label: string;
}

export interface ComputeSizeOption {
  slug: string;
  label: string;
  hourlyUsd: number;
  monthlyUsd: number;
}

// Keep this list aligned with the exact region enum accepted by the checked-in
// Supabase CLI version. Newer Supabase documentation may advertise regions that
// the pinned CLI cannot provision yet.
export const REGIONS: readonly RegionOption[] = [
  { id: "us-east-1", label: "East US (North Virginia)" },
  { id: "us-east-2", label: "East US (Ohio)" },
  { id: "us-west-1", label: "West US (North California)" },
  { id: "us-west-2", label: "West US (Oregon)" },
  { id: "ca-central-1", label: "Canada (Central)" },
  { id: "sa-east-1", label: "South America (São Paulo)" },
  { id: "eu-west-1", label: "West EU (Ireland)" },
  { id: "eu-west-2", label: "West Europe (London)" },
  { id: "eu-west-3", label: "West EU (Paris)" },
  { id: "eu-central-1", label: "Central EU (Frankfurt)" },
  { id: "eu-central-2", label: "Central Europe (Zurich)" },
  { id: "eu-north-1", label: "North EU (Stockholm)" },
  { id: "ap-east-1", label: "East Asia (Hong Kong)" },
  { id: "ap-south-1", label: "South Asia (Mumbai)" },
  { id: "ap-southeast-1", label: "Southeast Asia (Singapore)" },
  { id: "ap-northeast-1", label: "Northeast Asia (Tokyo)" },
  { id: "ap-northeast-2", label: "Northeast Asia (Seoul)" },
  { id: "ap-southeast-2", label: "Oceania (Sydney)" },
] as const;

export const COMPUTE_SIZES = [
  { slug: "micro", label: "Micro", hourlyUsd: 0.01344, monthlyUsd: 10 },
  { slug: "small", label: "Small", hourlyUsd: 0.0206, monthlyUsd: 15 },
  { slug: "medium", label: "Medium", hourlyUsd: 0.0822, monthlyUsd: 60 },
  { slug: "large", label: "Large", hourlyUsd: 0.1517, monthlyUsd: 111 },
  { slug: "xlarge", label: "XL", hourlyUsd: 0.2877, monthlyUsd: 210 },
  { slug: "2xlarge", label: "2XL", hourlyUsd: 0.562, monthlyUsd: 410 },
  { slug: "4xlarge", label: "4XL", hourlyUsd: 1.32, monthlyUsd: 960 },
  { slug: "8xlarge", label: "8XL", hourlyUsd: 2.562, monthlyUsd: 1870 },
  { slug: "12xlarge", label: "12XL", hourlyUsd: 3.836, monthlyUsd: 2800 },
  { slug: "16xlarge", label: "16XL", hourlyUsd: 5.12, monthlyUsd: 3730 },
] as const satisfies readonly ComputeSizeOption[];

export type ComputeSizeSlug = (typeof COMPUTE_SIZES)[number]["slug"];

const VALUE_FLAGS = new Set(["--name", "--org-id", "--region", "--size"]);
const BOOLEAN_FLAGS = new Set(["--dry-run", "--yes", "--help", "-h"]);

export function parseCliArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    yes: false,
    help: false,
  };
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (VALUE_FLAGS.has(arg)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value after ${arg}.`);
      }
      index += 1;

      switch (arg) {
        case "--name":
          options.projectName = value;
          break;
        case "--org-id":
          options.orgId = value;
          break;
        case "--region":
          options.region = value;
          break;
        case "--size":
          options.size = parseComputeSize(value);
          break;
      }
      continue;
    }

    if (BOOLEAN_FLAGS.has(arg)) {
      switch (arg) {
        case "--dry-run":
          options.dryRun = true;
          break;
        case "--yes":
          options.yes = true;
          break;
        case "--help":
        case "-h":
          options.help = true;
          break;
      }
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    positionals.push(arg);
  }

  if (positionals.length > 1) {
    throw new Error(`Unexpected argument: ${positionals[1]}`);
  }
  if (positionals[0] && options.projectName) {
    throw new Error(
      "Specify the project name positionally or with --name, not both.",
    );
  }
  if (positionals[0]) options.projectName = positionals[0];

  if (
    options.region &&
    !REGIONS.some((region) => region.id === options.region)
  ) {
    throw new Error(
      `Unsupported region: ${options.region}. Run with --help to see supported regions.`,
    );
  }

  return options;
}

export function parseComputeSize(value: string): ComputeSizeSlug {
  const size = COMPUTE_SIZES.find((candidate) => candidate.slug === value);
  if (!size) {
    throw new Error(
      `Unsupported compute size: ${value}. Use ${COMPUTE_SIZES.map(({ slug }) => slug).join(", ")}.`,
    );
  }
  return size.slug;
}

export function buildCreateArgs(plan: ProvisionPlan): string[] {
  const args = [
    "exec",
    "supabase",
    "projects",
    "create",
    plan.projectName,
    "--org-id",
    plan.orgId,
    "--region",
    plan.region,
  ];
  if (plan.size) args.push("--size", plan.size);
  args.push("--output", "json");
  return args;
}

export function computeDescription(size?: ComputeSizeSlug): string {
  if (!size) {
    return "Automatic (Free allocation on a Free organization; Micro by default on paid organizations)";
  }
  const option = COMPUTE_SIZES.find((candidate) => candidate.slug === size);
  if (!option) return size;
  return `${option.label} (~$${option.monthlyUsd.toLocaleString("en-US")}/month, $${option.hourlyUsd}/hour)`;
}

export function formatHelp(): string {
  const regions = REGIONS.map(
    ({ id, label }) => `  ${id.padEnd(16)} ${label}`,
  ).join("\n");
  const sizes = COMPUTE_SIZES.map(
    ({ slug, label, monthlyUsd }) =>
      `  ${slug.padEnd(10)} ${label.padEnd(6)} ~$${monthlyUsd.toLocaleString("en-US")}/month`,
  ).join("\n");

  return `
Provision a hosted Supabase project with a review and cost confirmation.

Usage:
  yarn supabase:provision [project-name] [options]

Options:
  --name <name>       Project name (alternative to the positional name)
  --org-id <id>       Supabase organization ID
  --region <region>   Exact AWS region; omit to choose interactively
  --size <size>       Paid compute override; omit for the organization default
  --dry-run           Resolve and print the plan without creating a project
  --yes               Skip KingStack's final confirmation (password still prompts)
  -h, --help          Show this help

Regions:
${regions}

Compute sizes:
${sizes}

Examples:
  yarn supabase:provision my-app
  yarn supabase:provision my-app --org-id example-org --region us-east-1 --dry-run
  yarn supabase:provision my-app --org-id example-org --region us-east-1 --size small

The script never accepts the database password as an argument. Supabase CLI asks
for it securely after confirmation. Pricing is guidance, not an invoice quote.
`;
}
