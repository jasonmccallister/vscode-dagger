import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { DaggerCLI } from "../cli";
import { askForModuleAddress } from "../utils/user-input";
import { Command } from "./types";
import { DaggerSettings } from "../settings";

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

export class McpCommand implements Command {
  constructor(
    private _dagger: DaggerCLI,
    private path: string,
    private _settings: DaggerSettings,
  ) {}

  execute = async (): Promise<void> => {
    const module = await askForModuleAddress();
    if (!module) {
      vscode.window.showInformationMessage(
        "Operation cancelled. You can add MCP modules later by running the 'Dagger: Add module MCP' command.",
      );
      return;
    }

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
          const mcpJsonPath = path.join(this.path, ".vscode", "mcp.json");
          let mcpConfig: McpConfig = {};

          // Read existing mcp.json if it exists
          if (await this.fileExists(mcpJsonPath)) {
            const content = await fs.promises.readFile(mcpJsonPath, "utf8");
            mcpConfig = JSON.parse(content);
          }

          // Initialize servers if it doesn't exist
          if (!mcpConfig.servers) {
            mcpConfig.servers = {};
          }

          // Generate a server name from the module address
          const generatedServerName = this.generateServerName(module);

          // Prompt user for server name with generated name as default
          const serverName = await vscode.window.showInputBox({
            placeHolder: generatedServerName,
            prompt:
              "Enter a name for the MCP server (press Enter to use the default)",
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
              "No",
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
            args: ["-m", module, "mcp"],
            env: {},
          };

          // Write the updated configuration
          const vscodeDir = path.join(this.path, ".vscode");

          // Ensure .vscode directory exists
          if (!(await this.fileExists(vscodeDir))) {
            await fs.promises.mkdir(vscodeDir, { recursive: true });
          }

          await fs.promises.writeFile(
            mcpJsonPath,
            JSON.stringify(mcpConfig, null, 2),
            "utf8",
          );

          vscode.window.showInformationMessage(
            `Successfully added "${finalServerName}" to MCP configuration at ${mcpJsonPath}`,
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(
            `Failed to add module to MCP configuration: ${errorMessage}`,
          );
          console.error("Error adding module to MCP configuration:", error);
        }

        // Ask user if they want to reload VS Code to apply changes
        const reload = await vscode.window.showInformationMessage(
          "MCP configuration updated. Would you like to reload VS Code to apply the changes?",
          "Reload",
          "Later",
        );

        if (reload === "Reload") {
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
        return;
      },
    );
  };

  private generateServerName = (moduleAddress: string): string => {
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
  private fileExists = async (filePath: string): Promise<boolean> => {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  };
}
