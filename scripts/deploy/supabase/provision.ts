import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createInterface, type Interface } from "node:readline/promises";
import {
  buildCreateArgs,
  COMPUTE_SIZES,
  computeDescription,
  type ComputeSizeSlug,
  type CliOptions,
  type ProvisionPlan,
  REGIONS,
} from "./options.js";

interface Organization {
  id: string;
  name: string;
}

interface Choice<T> {
  label: string;
  value: T;
}

const BILLING_DOCS =
  "https://supabase.com/docs/guides/platform/billing-on-supabase";
const COMPUTE_DOCS =
  "https://supabase.com/docs/guides/platform/manage-your-usage/compute";
const PRICING_PAGE = "https://supabase.com/pricing";

function runYarn(
  args: string[],
  options: {
    capture?: boolean;
    display?: string;
  } = {},
): string {
  if (options.display) console.log(`> ${options.display}`);
  const result = spawnSync("yarn", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: options.capture ? ["inherit", "pipe", "pipe"] : "inherit",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`Could not run yarn: ${result.error.message}`, {
      cause: result.error,
    });
  }
  if (result.status !== 0) {
    const details = options.capture
      ? [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
      : "";
    throw new Error(
      `${options.display || `yarn ${args.join(" ")}`} exited with status ${result.status ?? "unknown"}.${details ? `\n${details}` : ""}`,
    );
  }

  return typeof result.stdout === "string" ? result.stdout.trim() : "";
}

function assertSupabaseCli(): void {
  try {
    runYarn(["exec", "supabase", "--version"], { capture: true });
  } catch {
    throw new Error(
      "Supabase CLI is unavailable. Run `yarn install` from the repository root.",
    );
  }
}

export function parseOrganizations(value: string): Organization[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error("Supabase CLI returned invalid organization JSON.", {
      cause: error,
    });
  }
  if (!Array.isArray(parsed)) {
    throw new Error(
      "Supabase CLI returned an unexpected organization response.",
    );
  }

  const organizations = parsed.flatMap((candidate): Organization[] => {
    if (typeof candidate !== "object" || candidate === null) return [];
    const record = candidate as Record<string, unknown>;
    return typeof record.id === "string" && typeof record.name === "string"
      ? [{ id: record.id, name: record.name }]
      : [];
  });
  if (organizations.length === 0) {
    throw new Error(
      "No Supabase organizations were found. Create one in the dashboard first.",
    );
  }
  return organizations;
}

function listOrganizations(): Organization[] {
  let output: string;
  try {
    output = runYarn(["exec", "supabase", "orgs", "list", "--output", "json"], {
      capture: true,
      display: "yarn exec supabase orgs list --output json",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not list Supabase organizations. Run \`yarn exec supabase login\` and retry.\n${message}`,
      { cause: error },
    );
  }
  return parseOrganizations(output);
}

function defaultProjectName(): string {
  try {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
    ) as { name?: unknown };
    if (typeof packageJson.name === "string" && packageJson.name.trim()) {
      return packageJson.name.replace(/^@[^/]+\//, "");
    }
  } catch {
    // The user can provide a name when package.json is unavailable or malformed.
  }
  return "kingstack-app";
}

async function promptText(
  interface_: Interface,
  question: string,
  defaultValue?: string,
): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = (await interface_.question(`${question}${suffix}: `)).trim();
  const value = answer || defaultValue;
  if (!value) throw new Error(`${question} is required.`);
  return value;
}

async function choose<T>(
  interface_: Interface,
  question: string,
  choices: readonly Choice<T>[],
  defaultIndex = 0,
): Promise<T> {
  console.log();
  console.log(question);
  choices.forEach((choice, index) => {
    console.log(`  ${index + 1}. ${choice.label}`);
  });
  const answer = (
    await interface_.question(`Select [${defaultIndex + 1}]: `)
  ).trim();
  const selectedIndex = answer === "" ? defaultIndex : Number(answer) - 1;
  if (!Number.isInteger(selectedIndex) || !choices[selectedIndex]) {
    throw new Error(`Enter a number from 1 to ${choices.length}.`);
  }
  return choices[selectedIndex].value;
}

async function resolvePlan(
  options: CliOptions,
  interface_: Interface | undefined,
): Promise<ProvisionPlan> {
  const requireInterface = (): Interface => {
    if (!interface_) {
      throw new Error(
        "Missing required options in a non-interactive terminal. Provide project name, --org-id, and --region.",
      );
    }
    return interface_;
  };

  const projectName =
    options.projectName ||
    (await promptText(
      requireInterface(),
      "Project name",
      defaultProjectName(),
    ));

  let orgId = options.orgId;
  if (!orgId) {
    const organizations = listOrganizations();
    orgId =
      organizations.length === 1
        ? organizations[0].id
        : await choose(
            requireInterface(),
            "Choose the Supabase organization. Its existing plan determines billing:",
            organizations.map(({ id, name }) => ({
              label: `${name} (${id})`,
              value: id,
            })),
          );
    if (organizations.length === 1) {
      console.log(
        `Using the only accessible organization: ${organizations[0].name} (${orgId})`,
      );
    }
  }

  const region =
    options.region ||
    (await choose(
      requireInterface(),
      "Choose the exact AWS region closest to most users:",
      REGIONS.map(({ id, label }) => ({
        label: `${label} (${id})`,
        value: id,
      })),
    ));

  let size: ComputeSizeSlug | undefined = options.size;
  if (!size && interface_) {
    size = await choose<ComputeSizeSlug | undefined>(
      interface_,
      "Choose compute. Automatic is safest when the organization may be on the Free plan:",
      [
        {
          label:
            "Automatic (recommended; Free allocation or paid Micro default)",
          value: undefined,
        },
        ...COMPUTE_SIZES.map((option) => ({
          label: `${option.label} (~$${option.monthlyUsd.toLocaleString("en-US")}/month compute)`,
          value: option.slug,
        })),
      ],
    );
  }

  return { projectName, orgId, region, size };
}

export function formatProvisioningPlan(plan: ProvisionPlan): string {
  return [
    "",
    "KingStack Supabase provisioning",
    `Project:      ${plan.projectName}`,
    `Organization: ${plan.orgId}`,
    `Region:       ${plan.region}`,
    `Compute:      ${computeDescription(plan.size)}`,
    "",
    "Cost guidance (verified 2026-08-07):",
    "- The project inherits its organization's plan; this script does not change it.",
    "- Free is $0, allows two active projects across organizations where you are",
    "  Owner or Admin, and may pause projects after one week of inactivity.",
    "- Pro starts at $25/month per organization. Paid plans receive $10/month in",
    "  compute credits total; every running project incurs hourly compute charges.",
    "- Compute is not protected by the Pro spend cap. Storage, egress, auth, and",
    "  other usage can add charges or reach plan quotas.",
    "- Pricing changes. Treat this as guidance and verify the billing page before",
    "  confirming.",
    "",
    `Billing: ${BILLING_DOCS}`,
    `Compute: ${COMPUTE_DOCS}`,
    `Pricing: ${PRICING_PAGE}`,
  ].join("\n");
}

async function confirm(interface_: Interface, yes: boolean): Promise<void> {
  if (yes) return;
  const answer = (
    await interface_.question(
      "\nCreate this Supabase project? This may incur charges. [y/N] ",
    )
  ).trim();
  if (!/^y(?:es)?$/i.test(answer)) throw new Error("Cancelled.");
}

function createProject(plan: ProvisionPlan): void {
  const args = buildCreateArgs(plan);
  console.log();
  console.log(
    "Important: enter and save a database password. Do not leave the Supabase prompt blank; CLI 2.112.0 does not return its generated password.",
  );
  console.log();
  console.log(
    `> yarn ${args.join(" ")} (Supabase will securely prompt for the database password)`,
  );
  runYarn(args);
}

function printNextSteps(): void {
  console.log();
  console.log("Created the Supabase project. Its reference is printed above.");
  console.log();
  console.log("Next steps:");
  console.log(
    "1. Link this workspace: yarn exec supabase link --project-ref <project-ref>",
  );
  console.log(
    "2. Inspect publishable/secret keys: yarn exec supabase projects api-keys --project-ref <project-ref>",
  );
  console.log(
    "3. Add the hosted values to config/<environment>.ts and run yarn env:<environment>.",
  );
  console.log(
    "4. Confirm an asymmetric Auth signing key is active in the Supabase dashboard.",
  );
  console.log("5. Apply schema migrations with yarn prisma:deploy.");
  console.log(
    "See docs/supabase/hosted-project-provisioning.md for the full handoff.",
  );
}

export async function provisionSupabase(options: CliOptions): Promise<void> {
  assertSupabaseCli();
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const interface_ = interactive
    ? createInterface({ input: process.stdin, output: process.stdout })
    : undefined;

  let plan: ProvisionPlan;
  try {
    plan = await resolvePlan(options, interface_);
    console.log(formatProvisioningPlan(plan));

    if (options.dryRun) {
      console.log();
      console.log("Dry run complete; no Supabase resources were changed.");
      return;
    }
    if (!interface_) {
      throw new Error(
        "Project creation requires an interactive terminal so Supabase CLI can securely prompt for the database password.",
      );
    }
    await confirm(interface_, options.yes);
  } finally {
    interface_?.close();
  }

  createProject(plan);
  printNextSteps();
}
