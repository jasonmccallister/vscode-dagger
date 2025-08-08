import * as vscode from "vscode";
import { registerTreeView } from "./tree/provider";
import { checkInstallation, InstallResult } from "./utils/installation";
import * as os from "os";
import { EXTENSION_NAME } from "./const";
import { registerTerminalProvider } from "./terminal";
import { VSCodeWorkspaceCache } from "./cache";
import { DaggerSettingsProvider, setGlobalSettings } from "./settings";
import { DaggerCLI } from "./cli";
import { CacheCommand } from "./commands/cache";
import { registerCloudCommand } from "./commands/setupCloud";
import { McpCommand } from "./commands/mcp";
import { ExposeCommand } from "./commands/expose";
import { DaggerViewFunctions } from "./commands/viewFunctions";
import { UninstallCommand } from "./commands/uninstall";
import { VersionCommand } from "./commands/version";
import { CallCommand } from "./commands/call";
import { DevelopCommand } from "./commands/develop";
import { InitCommand } from "./commands/init";
import { InstallCommand } from "./commands/install";
import { InstallModuleCommand } from "./commands/installModule";
import { ShellCommand } from "./commands/shell";
import { TaskCommand } from "./commands/task";
import { GraphQLCommand } from "./commands/graphql";
import { UpdateCommand } from "./commands/update";
import { ExportCommand } from "./commands/export";
import { TerminalCommand } from "./commands/terminal";
import { ContextDirectoryCommand } from "./commands/context";

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
      vscode.commands.registerCommand("dagger.install", () =>
        new InstallCommand(settings).execute(),
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand("dagger.clearCache", () =>
        new CacheCommand(daggerCli).execute(),
      ),
    );
    registerCloudCommand(context, daggerCli, settings);
    context.subscriptions.push(
      vscode.commands.registerCommand("dagger.call", (treeItem) =>
        new CallCommand(daggerCli, path, settings).execute(treeItem),
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand("dagger.develop", () =>
        new DevelopCommand(daggerCli, path, settings).execute(),
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand("dagger.functions", () =>
        new DaggerViewFunctions().execute(),
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand("dagger.init", () =>
        new InitCommand(daggerCli, path).execute(),
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand("dagger.installModule", () =>
        new InstallModuleCommand(daggerCli, path).execute(),
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand("dagger.addMcpModule", () =>
        new McpCommand(daggerCli, path, settings).execute(),
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand("dagger.context", () =>
        new ContextDirectoryCommand(daggerCli, path, settings).execute(),
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand("dagger.expose", () =>
        new ExposeCommand(daggerCli, path, settings).execute(),
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand("dagger.saveTask", (treeItem) =>
        new TaskCommand(daggerCli, path).execute(treeItem),
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand("dagger.shell", () =>
        new ShellCommand(context, path).execute(),
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand("dagger.uninstall", () =>
        new UninstallCommand(settings).execute(),
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand("dagger.update", () =>
        new UpdateCommand(daggerCli, path, settings).execute(),
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand("dagger.terminal", () =>
        new TerminalCommand(daggerCli, path, settings).execute(),
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand("dagger.version", () =>
        new VersionCommand(daggerCli, path).execute(),
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand("dagger.graphql", () =>
        new GraphQLCommand(daggerCli, path).execute(),
      ),
    );
    context.subscriptions.push(
      vscode.commands.registerCommand("dagger.export", () =>
        new ExportCommand(daggerCli, path, settings).execute(),
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
      path: path,
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
  path: string,
): Promise<void> => {
  registerTreeView(context, {
    daggerCli,
    path: path,
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
