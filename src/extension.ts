import * as vscode from "vscode";
import { registerTreeView } from "./tree/provider";
import { checkInstallation, InstallResult } from "./utils/installation";
import * as os from "os";
import { EXTENSION_NAME } from "./const";
import { registerTerminalProvider } from "./terminal";
import { VSCodeWorkspaceCache } from "./cache";
import { DaggerSettingsProvider, setGlobalSettings } from "./settings";
import { DaggerCLI } from "./cli";
import { registerInstallCommand } from "./commands/installDagger";
import { registerClearCacheCommand } from "./commands/clearCache";
import { registerCloudCommand } from "./commands/setupCloud";
import { registerDevelopCommand } from "./commands/developModule";
import { registerAddMcpModuleCommand } from "./commands/addMCPModule";
import { registerExposeServiceCommand } from "./commands/exposeService";
import { registerFunctionsCommand } from "./commands/viewFunctions";
import { registerInitCommand } from "./commands/initModule";
import { registerInstallModuleCommand } from "./commands/installModule";
import { registerSaveTaskCommand } from "./commands/saveFunctionAsTask";
import { registerShellCommand } from "./commands/openShell";
import { registerUninstallCommand } from "./commands/uninstallDagger";
import { registerUpdateCommand } from "./commands/updateDagger";
import { registerVersionCommand } from "./commands/daggerVersion";
import { registerCallCommand } from "./commands/callFunction";
import { registerStartGraphQLServer } from "./commands/startGraphQLServer";

export async function activate(context: vscode.ExtensionContext) {
  try {
    const cache = new VSCodeWorkspaceCache(context.workspaceState);

    // Initialize settings provider
    const settings = new DaggerSettingsProvider();

    // Set global settings instance
    setGlobalSettings(settings);

    const daggerCli = new DaggerCLI(cache, settings);

    // Get workspace path
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";

    // Register configuration change listener to reload settings
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("dagger")) {
          settings.reload();
        }
      }),
    );

    // register the install command
    registerInstallCommand(context, settings);

    // Check installation status before setting up other commands and views
    const result = await checkInstallation(os.platform());
    if (!result.hasCorrectBinary) {
      await handleMissingInstallation(
        context,
        result,
        settings,
        daggerCli,
        workspace,
      );

      return;
    }

    // register the remaining commands because Dagger is installed
    registerClearCacheCommand(context, daggerCli);
    registerCloudCommand(context, daggerCli, settings);
    registerCallCommand(context, daggerCli, workspace, settings);
    registerDevelopCommand(context, daggerCli, workspace);
    registerFunctionsCommand(context);
    registerInitCommand(context, daggerCli);
    registerInstallModuleCommand(context, daggerCli, workspace);
    registerAddMcpModuleCommand(context, daggerCli, workspace);
    registerExposeServiceCommand(context, daggerCli, workspace, settings);
    registerSaveTaskCommand(context, daggerCli, workspace);
    registerShellCommand(context, workspace);
    registerUninstallCommand(context, settings);
    registerUpdateCommand(context, daggerCli, settings, workspace);
    registerVersionCommand(context, daggerCli, workspace);
    registerStartGraphQLServer(context, daggerCli, workspace);

    // Register tree view with settings
    registerTreeView(context, {
      daggerCli,
      workspacePath: workspace,
      registerTreeCommands: true,
      settings,
    });

    // register the terminal profile provider
    registerTerminalProvider(context);

    if (!settings.cloudNotificationDismissed) {
      // Show cloud notification
      vscode.window.showInformationMessage(
        "Dagger Cloud is now available! Use the 'Dagger: Cloud' command to connect your Dagger projects to the cloud.",
        "Learn More",
      );
    }
  } catch (error) {
    console.error("Failed to activate Dagger extension:", error);

    vscode.window.showErrorMessage(
      `Failed to activate Dagger extension: ${error}`,
    );
  }
}

const handleMissingInstallation = async (
  context: vscode.ExtensionContext,
  installResult: InstallResult,
  settings: DaggerSettingsProvider,
  daggerCli: DaggerCLI,
  workspace: string,
): Promise<void> => {
  registerTreeView(context, {
    daggerCli,
    workspacePath: workspace,
    registerTreeCommands: false,
    settings,
  });

  // Determine available installation methods for the prompt
  const installButtons: { title: string; command: string; method?: string }[] =
    [];
  if (
    installResult.hasHomebrew &&
    (installResult.platform === "darwin" || installResult.platform === "linux")
  ) {
    installButtons.push({
      title: "Homebrew (recommended)",
      command: "dagger.install",
      method: "brew",
    });
  }
  installButtons.push({
    title: "Curl script",
    command: `dagger.install`,
    method: "curl",
  });

  // Show installation prompt with buttons
  const selectedButton = await vscode.window.showInformationMessage(
    `${EXTENSION_NAME} is not installed or not properly configured. Please select an installation method:`,
    ...installButtons.map((button) => button.title),
  );

  const selectedOption = installButtons.find(
    (button) => button.title === selectedButton,
  );
  if (selectedOption) {
    await vscode.commands.executeCommand(
      selectedOption.command,
      selectedOption.method,
    );
    return;
  }

  vscode.window.showWarningMessage(
    `Install skipped, you can install using \`${EXTENSION_NAME}: Install CLI\`.`,
  );
};
