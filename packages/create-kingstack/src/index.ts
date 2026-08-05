#!/usr/bin/env node
// ============================================================================
// create-kingstack - CLI to create a new project from the KingStack template
// ============================================================================

import prompts from "prompts";
import pc from "picocolors";
import { existsSync, readdirSync } from "fs";

// Module imports
import { parseArgs, printHelp, promptForConfig } from "./cli";
import {
  banner,
  info,
  success,
  warn,
  error,
  step,
  runCommand,
  startDevServer,
  startSupabase,
} from "./utils";
import {
  validateTools,
  displayToolStatus,
  checkDockerRunning,
  printMissingToolsError,
  printDockerNotRunningError,
} from "./validators";
import {
  cloneTemplate,
  replaceNamespace,
  replaceWorkspaceVersions,
  prepareGeneratedProject,
} from "./template";
import {
  generateLocalConfig,
  configureProjectSetup,
  updateRootPackageJson,
  initGit,
  deleteYarnLock,
} from "./config-generators";
import { getSetupProfile } from "./setup";
import { PORT_BLOCK_SIZE } from "./constants";
import { allocateProjectPorts } from "./ports";
import { runPortCli } from "./port-cli";

// ============================================================================
// Main
// ============================================================================

async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs[0] === "ports") {
    process.exitCode = await runPortCli(rawArgs.slice(1));
    return;
  }

  const args = parseArgs(rawArgs);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  banner();

  // Validate the tools every setup needs before opening interactive prompts.
  // Docker is validated later because draft setup does not require it.
  const coreToolCheck = validateTools({ requireDocker: false });
  if (!coreToolCheck.success) {
    displayToolStatus(coreToolCheck.status, { requireDocker: false });
    printMissingToolsError(coreToolCheck.missing);
    process.exit(1);
  }

  // Show base directory if not cwd
  if (args.baseDir !== process.cwd()) {
    info(`Base directory: ${pc.dim(args.baseDir)}`);
    console.log();
  }

  const config = await promptForConfig(args);
  if (!config) {
    error("Project name is required");
    process.exit(1);
  }

  const { projectName, requestedPortBase, targetDir, setup } = config;
  const profile = getSetupProfile(setup);

  const toolCheck = validateTools({
    requireDocker: profile.requiresDocker,
  });
  displayToolStatus(toolCheck.status, {
    requireDocker: profile.requiresDocker,
  });

  if (!toolCheck.success) {
    printMissingToolsError(toolCheck.missing);
    process.exit(1);
  }

  if (profile.requiresDocker && !checkDockerRunning()) {
    printDockerNotRunningError();
    process.exit(1);
  }

  // ==========================================================================
  // Setup
  // ==========================================================================

  const totalSteps = profile.totalSteps;

  // Check if directory exists and not empty
  if (existsSync(targetDir)) {
    const files = readdirSync(targetDir);
    if (files.length > 0) {
      const { overwrite } = await prompts({
        type: "confirm",
        name: "overwrite",
        message: `Directory ${projectName} is not empty. Continue anyway?`,
        initial: false,
      });
      if (!overwrite) {
        info("Setup cancelled.");
        process.exit(0);
      }
    }
  }

  info(
    requestedPortBase === undefined
      ? "Finding an available project port block..."
      : `Checking requested port block ${requestedPortBase}-${requestedPortBase + PORT_BLOCK_SIZE - 1}...`,
  );
  const { basePort, ports } = await allocateProjectPorts({
    projectName,
    targetDir,
    preferredBase: requestedPortBase,
  });

  console.log();
  console.log(pc.dim("  ─────────────────────────────────"));
  console.log();
  info(`Creating ${pc.bold(projectName)} in ${pc.dim(targetDir)}`);
  info(`Setup: ${pc.bold(profile.label)}`);
  info(
    `Ports: ${pc.bold(`${basePort}-${basePort + PORT_BLOCK_SIZE - 1}`)} ${
      requestedPortBase === undefined
        ? pc.dim("(automatic)")
        : pc.dim("(custom)")
    }`,
  );

  // ==========================================================================
  // Step 1: Clone template
  // ==========================================================================
  step(
    1,
    totalSteps,
    args.templateDir
      ? "Copying local KingStack working tree..."
      : "Downloading KingStack template...",
  );
  const cloned = cloneTemplate(targetDir, {
    templateDir: args.templateDir,
  });
  if (!cloned) {
    error("Failed to download template.");
    process.exit(1);
  }
  success("Template downloaded");

  // ==========================================================================
  // Step 2: Prepare the generated-project boundary
  // ==========================================================================
  step(2, totalSteps, "Preparing generated project...");
  prepareGeneratedProject(targetDir);
  success("Excluded published-library source and maintainer tooling");

  // ==========================================================================
  // Step 3: Replace namespace
  // ==========================================================================
  step(3, totalSteps, `Renaming namespace to @${projectName}...`);
  const modifiedFiles = replaceNamespace(targetDir, projectName);
  updateRootPackageJson(targetDir, projectName);
  success(`Updated ${modifiedFiles} files`);

  // ==========================================================================
  // Step 4: Update package versions
  // ==========================================================================
  step(4, totalSteps, "Updating package versions...");
  const versionsUpdated = replaceWorkspaceVersions(targetDir);
  success(`Updated ${versionsUpdated} package.json files with npm versions`);

  // ==========================================================================
  // Step 5: Generate config
  // ==========================================================================
  step(5, totalSteps, "Generating configuration...");
  generateLocalConfig(targetDir, projectName, ports);
  configureProjectSetup(targetDir, setup);
  success("Created config/local.ts");

  // ==========================================================================
  // Step 6: Initialize git
  // ==========================================================================
  step(6, totalSteps, "Initializing git repository...");
  if (initGit(targetDir)) {
    success("Git repository initialized");
  } else {
    warn("Could not initialize git (git may not be installed)");
  }

  // ==========================================================================
  // Step 7: Install dependencies
  // ==========================================================================
  step(7, totalSteps, "Installing dependencies...");
  info("This may take a minute...");
  deleteYarnLock(targetDir);
  if (!runCommand("yarn install", targetDir)) {
    error("Failed to install dependencies. Run 'yarn install' manually.");
    process.exit(1);
  }
  success("Dependencies installed");

  // ==========================================================================
  // Step 8: Generate Prisma client
  // ==========================================================================
  step(8, totalSteps, "Generating Prisma client...");
  if (!runCommand("yarn prisma:generate", targetDir, true)) {
    warn(
      "Prisma client generation failed. Run 'yarn prisma:generate' manually.",
    );
  } else {
    success("Prisma client generated");
  }

  step(9, totalSteps, "Generating environment files...");
  if (!runCommand("yarn env:local", targetDir)) {
    error("Failed to generate environment.");
    process.exit(1);
  }
  success("Environment files generated");

  if (setup === "full") {
    step(10, totalSteps, "Starting Supabase...");
    // startSupabase shows its own messages
    const supabaseStarted = startSupabase(targetDir);
    if (!supabaseStarted) {
      console.log();
      warn("Supabase failed to start. Check the error messages above.");
      console.log();
      console.log(pc.bold("  To complete setup manually:"));
      console.log();
      console.log(pc.dim("  1.") + ` cd ${projectName}`);
      console.log(pc.dim("  2.") + " yarn supabase:start");
      console.log(pc.dim("  3.") + " bun scripts/setup-shadow-db.ts");
      console.log(pc.dim("  4.") + " yarn prisma:migrate");
      console.log(pc.dim("  5.") + " yarn dev");
      console.log();
      process.exit(1);
    }
    success("Supabase started");

    step(11, totalSteps, "Setting up database...");
    info("Creating shadow database...");
    if (!runCommand("bun scripts/setup-shadow-db.ts", targetDir)) {
      warn("Shadow database setup failed. You may need to run it manually.");
    } else {
      success("Shadow database created");
    }

    info("Running migrations...");
    if (!runCommand("yarn prisma:migrate", targetDir)) {
      warn(
        "Migrations failed. Run 'yarn prisma:migrate' manually after fixing any issues.",
      );
    } else {
      success("Database migrated");
    }

    step(
      12,
      totalSteps,
      args.noStart
        ? "Full-stack project is ready"
        : "Starting full-stack development server...",
    );
  } else {
    step(
      10,
      totalSteps,
      args.noStart
        ? "Frontend-draft project is ready"
        : "Starting frontend draft server...",
    );
    info("Backend services were not started. Add them whenever you are ready.");
  }

  if (args.noStart) {
    success(`Project generated at ${targetDir}`);
    info(`Start it later with: cd ${targetDir} && yarn ${profile.devScript}`);
    return;
  }

  startDevServer(targetDir, ports.next, {
    script: profile.devScript,
  });
}

main().catch((err) => {
  error(err.message);
  process.exit(1);
});
