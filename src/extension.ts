import * as vscode from "vscode";
import { registerTreeView } from "./tree/provider";
import { checkInstallation, InstallResult } from "./utils/installation";
import * as os from "os";
import { EXTENSION_NAME } from "./const";
import { registerTerminalProvider } from "./terminal";
import { VSCodeWorkspaceCache } from "./cache";
import { DaggerSettingsProvider, setGlobalSettings } from "./settings";
import { DaggerCLI } from "./cli";
import { ClearCacheCommand } from "./commands/clearCache";
import { registerCloudCommand } from "./commands/setupCloud";
import { AddMcpModuleCommand } from "./commands/addMCPModule";
import { ExposeServiceCommand } from "./commands/exposeService";
import { DaggerViewFunctions } from "./commands/viewFunctions";
import { UninstallDaggerCommand } from "./commands/uninstallDagger";
import { DaggerVersionCommand } from "./commands/daggerVersion";
import { CallFunctionCommand } from "./commands/callFunction";
import { DevelopModuleCommand } from "./commands/developModule";
import { InitModuleCommand } from "./commands/initModule";
import { InstallCommand } from "./commands/installDagger";
import { InstallModuleCommand } from "./commands/installModule";
import { OpenShellCommand } from "./commands/openShell";
import { SaveFunctionAsTaskCommand } from "./commands/saveFunctionAsTask";
import { StartGraphQLServerCommand } from "./commands/startGraphQLServer";
import { UpdateDaggerCommand } from "./commands/updateDagger";
import { ExportCommand } from "./commands/export";

export async function activate(context: vscode.ExtensionContext) {
  try {
    const cache = new VSCodeWorkspaceCache(context.workspaceState);

    // Initialize settings provider
    const settings = new DaggerSettingsProvider();

    // Set global settings instance
    setGlobalSettings(settings);

    const daggerCli = new DaggerCLI(cache, settings);

    // Get workspace path
    const path = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";

    // Register configuration change listener to reload settings
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("dagger")) {
          settings.reload();
        }
      }),
    );

    // register the install command
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dagger.install",
        new InstallCommand(settings).execute,
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dagger.clearCache",
        new ClearCacheCommand(daggerCli).execute,
      ),
    );
    registerCloudCommand(context, daggerCli, settings);
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dagger.call",
        new CallFunctionCommand(daggerCli, path, settings).execute,
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dagger.develop",
        new DevelopModuleCommand(daggerCli, path, settings).execute,
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dagger.functions",
        new DaggerViewFunctions().execute,
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dagger.init",
        new InitModuleCommand(daggerCli, path).execute,
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dagger.installModule",
        new InstallModuleCommand(daggerCli, path).execute,
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dagger.addMcpModule",
        new AddMcpModuleCommand(daggerCli, path, settings).execute,
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dagger.exposeService",
        new ExposeServiceCommand(daggerCli, path, settings).execute,
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dagger.saveTask",
        new SaveFunctionAsTaskCommand(daggerCli, path).execute,
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dagger.openShell",
        new OpenShellCommand(context, path).execute,
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dagger.uninstall",
        new UninstallDaggerCommand(settings).execute,
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dagger.update",
        new UpdateDaggerCommand(daggerCli, path, settings).execute,
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dagger.version",
        new DaggerVersionCommand(daggerCli, path).execute,
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dagger.startGraphQLServer",
        new StartGraphQLServerCommand(daggerCli, path).execute,
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dagger.export",
        new ExportCommand(daggerCli, path, settings).execute,
      ),
    );

    // Check installation status before setting up other commands and views
    const result = await checkInstallation(os.platform());
    if (!result.hasCorrectBinary) {
      await handleMissingInstallation(
        context,
        result,
        settings,
        daggerCli,
        path,
      );

      return;
    }

    // Register tree view with settings
    registerTreeView(context, {
      daggerCli,
      workspacePath: path,
      registerTreeCommands: true,
      settings,
    });

    // Show Dagger Shell terminal when opened (including from profile quick pick)
    context.subscriptions.push(
      vscode.window.onDidOpenTerminal((terminal) => {
        if (terminal.name === "Dagger") {
          terminal.show();
        }
      }),
    );

    // register the terminal profile provider
    registerTerminalProvider(context);

    if (!settings.cloudNotificationDismissed) {
      // Show cloud notification
      vscode.window.showInformationMessage(
        "Setup Dagger Cloud to gain greater insight into your workflows and share them with your team.",
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
