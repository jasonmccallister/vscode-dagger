import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import Cli from "../../dagger";
import { showProjectSetupPrompt } from "../../prompt";

export const COMMAND = "dagger.addMcpModule";

interface McpConfig {
  servers?: {
    [key: string]: {
      type: "stdio";
      command: string;
      args?: string[];
      env?: Record<string, string>;
    };
  };
}

export const registerAddMcpModuleCommand = (
  context: vscode.ExtensionContext,
  cli: Cli,
  workspace: string
): void => {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND, async () => {
      if (!(await cli.isDaggerProject())) {
        showProjectSetupPrompt();
        return;
      }

      // Prompt user for module address
      const moduleAddress = await vscode.window.showInputBox({
        placeHolder: "github.com/user/repo, https://github.com/user/repo.git, or . for current directory",
        prompt:
          "Enter the Dagger module address (Git URL, GitHub repository, or . for current directory)",
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return "Please provide a valid module address.";
          }

          // Basic validation for common patterns
          const trimmedValue = value.trim();
          const isCurrentDir = trimmedValue === ".";
          const isGitUrl =
            trimmedValue.startsWith("http") || trimmedValue.startsWith("git@");
          const isGithubShorthand = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(
            trimmedValue
          );
          const isGithubPath = trimmedValue.startsWith("github.com/");

          if (!isCurrentDir && !isGitUrl && !isGithubShorthand && !isGithubPath) {
            return "Please provide a valid Git URL, GitHub repository, or . for current directory";
          }

          return null;
        },
      });

      if (!moduleAddress) {
        vscode.window.showInformationMessage(
          'Operation cancelled. You can add MCP modules later by running the "Dagger: Add module MCP" command.'
        );
        return;
      }

      await addModuleToMcpConfig(moduleAddress.trim(), workspace);
    })
  );
};

/**
 * Adds a Dagger module to the MCP configuration
 * @param moduleAddress The module address or URL
 * @param workspace The workspace directory path
 */
const addModuleToMcpConfig = async (
  moduleAddress: string,
  workspace: string
): Promise<void> => {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Dagger",
      cancellable: true,
    },
    async (progress, token) => {
      progress.report({ message: "Adding module to MCP configuration..." });

      if (token.isCancellationRequested) {
        return;
      }

      try {
        const mcpJsonPath = path.join(workspace, ".vscode", "mcp.json");
        let mcpConfig: McpConfig = {};

        // Read existing mcp.json if it exists
        if (await fileExists(mcpJsonPath)) {
          const content = await fs.promises.readFile(mcpJsonPath, "utf8");
          mcpConfig = JSON.parse(content);
        }

        // Initialize servers if it doesn't exist
        if (!mcpConfig.servers) {
          mcpConfig.servers = {};
        }

        // Generate a server name from the module address
        const generatedServerName = generateServerName(moduleAddress);

        // Prompt user for server name with generated name as default
        const serverName = await vscode.window.showInputBox({
          placeHolder: generatedServerName,
          prompt: "Enter a name for the MCP server (press Enter to use the default)",
          value: generatedServerName,
          validateInput: (value) => {
            const trimmedValue = value?.trim();
            if (!trimmedValue || trimmedValue.length === 0) {
              return "Server name cannot be empty.";
            }
            
            // Check for valid server name characters
            if (!/^[a-zA-Z0-9_-]+$/.test(trimmedValue)) {
              return "Server name can only contain letters, numbers, underscores, and hyphens.";
            }
            
            return null;
          },
        });

        if (!serverName) {
          vscode.window.showInformationMessage("Operation cancelled.");
          return;
        }

        const finalServerName = serverName.trim();

        // Check if server already exists
        if (mcpConfig.servers[finalServerName]) {
          const overwrite = await vscode.window.showWarningMessage(
            `MCP server "${finalServerName}" already exists. Do you want to overwrite it?`,
            { modal: true },
            "Yes",
            "No"
          );

          if (overwrite !== "Yes") {
            vscode.window.showInformationMessage("Operation cancelled.");
            return;
          }
        }

        // Add the new server configuration
        mcpConfig.servers[finalServerName] = {
          type: "stdio",
          command: "dagger",
          args: ["-m", moduleAddress, "mcp"],
          env: {},
        };

        // Write the updated configuration
        const vscodeDir = path.join(workspace, ".vscode");

        // Ensure .vscode directory exists
        if (!(await fileExists(vscodeDir))) {
          await fs.promises.mkdir(vscodeDir, { recursive: true });
        }

        await fs.promises.writeFile(
          mcpJsonPath,
          JSON.stringify(mcpConfig, null, 2),
          "utf8"
        );

        vscode.window.showInformationMessage(
          `Successfully added "${finalServerName}" to MCP configuration at ${mcpJsonPath}`
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(
          `Failed to add module to MCP configuration: ${errorMessage}`
        );
        console.error("Error adding module to MCP configuration:", error);
      }

      // Ask user if they want to reload VS Code to apply changes
      const reload = await vscode.window.showInformationMessage(
        "MCP configuration updated. Would you like to reload VS Code to apply the changes?",
        "Reload",
        "Later"
      );
      
      if (reload === "Reload") {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    }
  );
};

/**
 * Generates a server name from a module address
 * @param moduleAddress The module address
 * @returns A valid server name
 */
const generateServerName = (moduleAddress: string): string => {
  // Handle current directory
  if (moduleAddress === ".") {
    return "current-directory";
  }

  // Extract meaningful name from various URL formats
  let name = moduleAddress;

  // Handle GitHub URLs
  if (name.includes("github.com/")) {
    const match = name.match(/github\.com\/([^\/]+\/[^\/]+)/);
    if (match) {
      name = match[1];
    }
  }

  // Handle Git URLs
  if (name.startsWith("git@")) {
    const match = name.match(/git@[^:]+:([^\/]+\/[^\/]+)/);
    if (match) {
      name = match[1];
    }
  }

  // Remove .git suffix
  name = name.replace(/\.git$/, "");

  // Replace invalid characters with hyphens
  name = name.replace(/[^a-zA-Z0-9_-]/g, "-");

  // Ensure it starts with a letter
  if (!/^[a-zA-Z]/.test(name)) {
    name = `dagger-${name}`;
  }

  return name;
};

/**
 * Checks if a file exists
 * @param filePath The path to check
 * @returns Promise resolving to true if file exists, false otherwise
 */
const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
};
