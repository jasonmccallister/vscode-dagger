import * as vscode from "vscode";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { DaggerSettings } from "../settings";
import { Command } from "./types";

const execAsync = promisify(exec);
const INSTALL_COMMAND_CURL =
  "curl -fsSL https://raw.githubusercontent.com/dagger/dagger/main/install.sh | bash";
const INSTALL_COMMAND_HOMEBREW = "brew install dagger/tap/dagger";

interface PlatformResult {
  hasHomebrew?: boolean;
  platform: string;
}

export class InstallCommand implements Command<string | undefined> {
  constructor(private settings: DaggerSettings) {}

  preExecute = async (): Promise<boolean> => {
    let hasCorrectBinary = false;
    try {
      const { stdout } = await execAsync("dagger version", { timeout: 5000 });
      hasCorrectBinary = stdout.includes("dagger");
    } catch (error) {
      // dagger binary doesn't exist or failed to execute
      hasCorrectBinary = false;
    }

    return hasCorrectBinary;
  };

  async execute(installationMethod?: "brew" | "curl"): Promise<void> {
    try {
      const shouldInstall = await this.preExecute();
      if (!shouldInstall) {
        vscode.window.showInformationMessage(
          "Dagger is already installed. No action needed.",
        );

        return; // Already installed, no need to proceed
      }

      let command: string;
      let methodLabel: string;

      // First check if we have an explicit installation method passed in
      if (installationMethod) {
        switch (installationMethod) {
          case "brew":
            command = INSTALL_COMMAND_HOMEBREW;
            methodLabel = "Homebrew";
            break;
          case "curl":
            command = INSTALL_COMMAND_CURL;
            methodLabel = "curl script";
            break;
          default:
            vscode.window.showErrorMessage(
              `Unknown installation method: ${installationMethod}`,
            );
            return;
        }
      }

      // Otherwise use the installation method from settings if available
      else if (this.settings) {
        switch (this.settings.installMethod) {
          case "brew":
            command = INSTALL_COMMAND_HOMEBREW;
            methodLabel = "Homebrew";
            break;
          case "curl":
            command = INSTALL_COMMAND_CURL;
            methodLabel = "curl script";
            break;
          default:
            vscode.window.showErrorMessage(
              `Unknown installation method in settings: ${this.settings.installMethod}`,
            );
            return;
        }
      }

      // If no explicit method or settings, use the default
      else {
        const result = await this.platformCheck(os.platform());
        if (result.platform === "darwin" && result.hasHomebrew) {
          command = INSTALL_COMMAND_HOMEBREW;
          methodLabel = "Homebrew";
        } else {
          command = INSTALL_COMMAND_CURL;
          methodLabel = "curl script";
        }
      }

      // Create a progress notification
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Installing Dagger",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: `Installing with ${methodLabel}...` });

          try {
            await execAsync(command);

            // If installation was successful and we have a settings object, update the installation method
            if (this.settings && installationMethod) {
              await this.settings.update(
                "installMethod",
                installationMethod,
                vscode.ConfigurationTarget.Global,
              );
            }

            vscode.window.showInformationMessage(
              `Dagger installed successfully using ${methodLabel}!`,
            );

            // Refresh the extension
            vscode.commands.executeCommand("workbench.action.reloadWindow");
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to install Dagger: ${error}`,
            );
          }
        },
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to check installation: ${error}`);
    }
  }

  private platformCheck = async (platform: string): Promise<PlatformResult> => {
    // Check if Homebrew is installed (for macOS/Linux)
    let hasHomebrew: boolean | undefined;
    if (platform === "darwin" || platform === "linux") {
      try {
        await execAsync("brew --version");
        hasHomebrew = true;
      } catch (error) {
        hasHomebrew = false;
      }
    }

    return {
      hasHomebrew,
      platform: platform,
    };
  };
}
