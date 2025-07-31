import * as vscode from "vscode";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { DaggerSettings } from "../settings";

const COMMAND = "dagger.install";
const execAsync = promisify(exec);
const INSTALL_COMMAND_CURL =
  "curl -fsSL https://raw.githubusercontent.com/dagger/dagger/main/install.sh | bash";
const INSTALL_COMMAND_HOMEBREW = "brew install dagger/tap/dagger";

interface InstallResult {
  isInstalled: boolean;
  hasCorrectBinary: boolean;
  hasHomebrew?: boolean;
  platform: string;
}

export const registerInstallCommand = (
  context: vscode.ExtensionContext,
  settings: DaggerSettings,
): void => {
  const installCommand = vscode.commands.registerCommand(
    COMMAND,
    async (installationMethod?: string) => {
      try {
        const result = await checkInstallation(os.platform());

        if (result.hasCorrectBinary) {
          vscode.window.showInformationMessage(
            "Dagger is already installed and ready to use!",
          );
          return;
        }

        await handleInstallation(result, installationMethod, settings);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to check installation: ${error}`,
        );
      }
    },
  );

  context.subscriptions.push(installCommand);
};

const handleInstallation = async (
  result: InstallResult,
  installationMethod?: string,
  settings?: DaggerSettings,
): Promise<void> => {
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
  else if (settings) {
    switch (settings.installMethod) {
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
          `Unknown installation method in settings: ${settings.installMethod}`,
        );
        return;
    }
  }
  // If no explicit method or settings, use the default
  else {
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
        if (settings && installationMethod) {
          await settings.update(
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
        vscode.window.showErrorMessage(`Failed to install Dagger: ${error}`);
      }
    },
  );
};

const checkInstallation = async (platform: string): Promise<InstallResult> => {
  // Check if binary exists
  let hasCorrectBinary = false;
  try {
    const { stdout } = await execAsync("dagger version", { timeout: 5000 });
    hasCorrectBinary = stdout.includes("dagger");
  } catch (error) {
    // dagger binary doesn't exist or failed to execute
    hasCorrectBinary = false;
  }

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
    isInstalled: hasCorrectBinary,
    hasCorrectBinary,
    hasHomebrew,
    platform,
  };
};
