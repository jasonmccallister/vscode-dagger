import * as vscode from "vscode";
import * as path from "path";
import Cli from "../../dagger";
import { showProjectSetupPrompt } from "../../prompt";

const COMMAND = "dagger.installModule";

export const registerInstallModuleCommand = (
  context: vscode.ExtensionContext,
  cli: Cli,
): void => {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND, async () => {
      if (!(await cli.isDaggerProject())) {
        showProjectSetupPrompt();
        return;
      }

      const workspace = getWorkspaceDirectory();

      // Ask user if they want to search for local directories first
      const searchLocal = await vscode.window.showInformationMessage(
        "Do you want to search for local modules in your workspace?",
        { modal: true },
        "Yes",
        "No",
      );

      if (searchLocal === "Yes") {
        await handleLocalModuleInstallation(cli, workspace);
      } else {
        await handleRemoteModuleInstallation(cli, workspace);
      }
    }),
  );
};

/**
 * Gets the current workspace directory
 * @returns The workspace directory path
 */
const getWorkspaceDirectory = (): string => {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  return workspaceFolders && workspaceFolders.length > 0
    ? workspaceFolders[0].uri.fsPath
    : process.cwd();
};

/**
 * Handles local module installation by searching for directories with dagger.json
 * @param cli The Dagger CLI instance
 * @param workspace The workspace directory path
 */
const handleLocalModuleInstallation = async (
  cli: Cli,
  workspace: string,
): Promise<void> => {
  const localModules = await findModulesInWorkspace(workspace);

  if (localModules.length === 0) {
    vscode.window.showInformationMessage(
      "No local modules found in workspace. You can install a remote module instead.",
    );
    await handleRemoteModuleInstallation(cli, workspace);
    return;
  }

  const modulePick = await vscode.window.showQuickPick(
    localModules.map((dir) => {
      const relativePath = path.relative(workspace, dir);
      return {
        label: relativePath,
        description: "$(folder) Local module found in workspace",
        detail: dir, // Store the full path in detail for reference
      };
    }),
    {
      placeHolder: "Select local modules to install",
      canPickMany: true,
    },
  );

  if (!modulePick || modulePick.length === 0) {
    return;
  }

  const selectedModules = modulePick.map((item) => item.detail || item.label);

  // Install each selected module
  for (const module of selectedModules) {
    await installModule(
      cli,
      module,
      workspace,
      `Installing local module from ${module}...`,
    );
  }
};

/**
 * Handles remote module installation by prompting for module address
 * @param cli The Dagger CLI instance
 * @param workspace The workspace directory path
 */
const handleRemoteModuleInstallation = async (
  cli: Cli,
  workspace: string,
): Promise<void> => {
  const moduleAddress = await vscode.window.showInputBox({
    placeHolder: "github.com/user/repo or https://github.com/user/repo.git",
    prompt: "Enter the module address (Git URL or GitHub repository)",
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Please provide a valid module address.";
      }

      // Basic validation for common patterns
      const trimmedValue = value.trim();
      const isGitUrl =
        trimmedValue.startsWith("http") || trimmedValue.startsWith("git@");
      const isGithubShorthand = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(
        trimmedValue,
      );
      const isGithubPath = trimmedValue.startsWith("github.com/");

      if (!isGitUrl && !isGithubShorthand && !isGithubPath) {
        return "Please provide a valid Git URL or GitHub repository (e.g., github.com/user/repo)";
      }

      return null;
    },
  });

  if (!moduleAddress) {
    vscode.window.showInformationMessage(
      'Installation cancelled. You can install modules later by running the "Dagger: Install Module" command.',
    );
    return;
  }

  await installModule(
    cli,
    moduleAddress.trim(),
    workspace,
    `Installing module from ${moduleAddress.trim()}...`,
  );
};

/**
 * Installs a single module using the Dagger CLI
 * @param cli The Dagger CLI instance
 * @param moduleAddress The module address or path
 * @param workspace The workspace directory path
 * @param progressMessage The message to show during installation
 */
const installModule = async (
  cli: Cli,
  moduleAddress: string,
  workspace: string,
  progressMessage: string,
): Promise<void> => {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Dagger",
      cancellable: true,
    },
    async (progress, token) => {
      progress.report({ message: progressMessage });

      if (token.isCancellationRequested) {
        return;
      }

      const result = await cli.run(["install", moduleAddress], {
        cwd: workspace,
      });

      if (!result.success) {
        vscode.window.showErrorMessage(
          `Failed to install module from ${moduleAddress}`,
        );
        console.error(
          `Dagger install module command failed for ${moduleAddress}: ${result.stderr}`,
        );
        return;
      }

      vscode.window.showInformationMessage(
        `Module installed successfully from ${moduleAddress}`,
      );
    },
  );
};

/**
 * Gets existing dependencies from the root dagger.json file
 * @param workspacePath The workspace directory path
 * @returns Set of dependency paths that are already defined
 */
const getExistingDependencies = async (
  workspacePath: string,
): Promise<Set<string>> => {
  const fs = require("fs").promises;
  const dependencies = new Set<string>();

  try {
    const daggerJsonPath = path.join(workspacePath, "dagger.json");
    if (await fileExists(daggerJsonPath)) {
      const content = await fs.readFile(daggerJsonPath, "utf8");
      const daggerConfig = JSON.parse(content);

      // Check for dependencies in various possible formats
      if (daggerConfig.dependencies) {
        for (const dep of daggerConfig.dependencies) {
          if (typeof dep === "string") {
            // Handle string dependencies (local paths)
            if (
              !dep.startsWith("http") &&
              !dep.startsWith("git@") &&
              !dep.includes("github.com")
            ) {
              dependencies.add(dep);
            }
          } else if (dep.source) {
            // Handle object dependencies with source property
            if (
              !dep.source.startsWith("http") &&
              !dep.source.startsWith("git@") &&
              !dep.source.includes("github.com")
            ) {
              dependencies.add(dep.source);
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn(`Could not read or parse dagger.json: ${error}`);
  }

  return dependencies;
};

/**
 * Finds all directories containing a dagger.json file in the current workspace (non-recursive)
 * @param workspacePath The workspace directory to search in
 * @returns Promise resolving to array of directory paths containing dagger.json
 */
const findModulesInWorkspace = async (
  workspacePath: string,
): Promise<string[]> => {
  const fs = require("fs").promises;
  const results: string[] = [];

  // Read existing dependencies from root dagger.json to exclude them
  const existingDependencies = await getExistingDependencies(workspacePath);

  try {
    const entries = await fs.readdir(workspacePath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Skip common directories that shouldn't contain modules
        if (
          entry.name === "node_modules" ||
          entry.name === ".git" ||
          entry.name === ".vscode"
        ) {
          continue;
        }

        const fullPath = path.join(workspacePath, entry.name);
        const relativePath = path.relative(workspacePath, fullPath);
        const daggerJsonPath = path.join(fullPath, "dagger.json");

        // Skip if this directory is already defined in root dagger.json
        if (
          existingDependencies.has(relativePath) ||
          existingDependencies.has(`./${relativePath}`)
        ) {
          continue;
        }

        if (await fileExists(daggerJsonPath)) {
          results.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.warn(`Could not read workspace directory ${workspacePath}:`, error);
  }

  return results;
};

/**
 * Checks if a file exists
 * @param filePath The path to check
 * @returns Promise resolving to true if file exists, false otherwise
 */
const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    const fs = require("fs").promises;
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Finds all subdirectories containing a specific file
 * @param basePath The base directory to search from
 * @param fileName The file name to search for
 * @returns Promise resolving to array of directory paths containing the file
 * @deprecated Use findModulesInWorkspace instead for workspace-only searches
 */
const findSubdirectoriesWithFile = async (
  basePath: string,
  fileName: string,
): Promise<string[]> => {
  const fs = require("fs").promises;

  const findDirs = async (dir: string): Promise<string[]> => {
    let results: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Skip node_modules and other common directories to avoid
          if (entry.name === "node_modules" || entry.name === ".git") {
            continue;
          }

          if (await fileExists(path.join(fullPath, fileName))) {
            results.push(fullPath);
          }
          results = results.concat(await findDirs(fullPath));
        }
      }
    } catch (error) {
      // Ignore permission errors and continue
      console.warn(`Could not read directory ${dir}:`, error);
    }

    return results;
  };

  const fileExists = async (filePath: string): Promise<boolean> => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  };

  return findDirs(basePath);
};
