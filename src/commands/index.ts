import * as vscode from "vscode";
import { registerInstallCommand } from "./install";
import Cli from "../dagger";
import { registerCallCommand } from "./call";
import { registerClearCacheCommand } from "./clear-cache";
import { registerCloudCommand } from "./cloud";
import { registerDevelopCommand } from "./develop";
import { registerFunctionsCommand } from "./functions";
import { registerInitCommand } from "./init";
import { registerInstallModuleCommand } from "./install-module";
import { registerResetCommand } from "./reset";
import { registerSaveTaskCommand } from "./save-task";
import { registerShellCommand } from "./shell";
import { registerUninstallCommand } from "./uninstall";
import { registerUpdateCommand } from "./update";
import { registerVersionCommand } from "./version";
import { showCloudIntegrationPrompt } from "../prompt";
import { registerTreeView } from "../tree/provider";
import { DaggerSettings } from "../settings";

type Options = {
  context: vscode.ExtensionContext;
  cli: Cli;
  workspacePath: string;
  settings: DaggerSettings;
};

export default class CommandManager {
  static options: Options;

  constructor(private options: Options) {
    // always register the install command
    registerInstallCommand(this.options.context, this.options.settings);
  }

  public register(): void {
    // Register all commands
    registerCallCommand(
      this.options.context,
      this.options.cli,
      this.options.workspacePath,
      this.options.settings
    );
    registerClearCacheCommand(this.options.context, this.options.cli);
    registerCloudCommand(
      this.options.context,
      this.options.cli,
      this.options.settings
    );
    registerDevelopCommand(
      this.options.context,
      this.options.cli,
      this.options.workspacePath
    );
    registerFunctionsCommand(this.options.context);
    registerInitCommand(this.options.context, this.options.cli);
    registerInstallModuleCommand(this.options.context, this.options.cli);
    registerResetCommand(this.options.context, this.options.settings);
    registerSaveTaskCommand(
      this.options.context,
      this.options.cli,
      this.options.workspacePath
    );
    registerShellCommand(this.options.context, this.options.workspacePath);
    registerUninstallCommand(this.options.context, this.options.settings);
    registerUpdateCommand(
      this.options.context,
      this.options.cli,
      this.options.settings
    );
    registerVersionCommand(this.options.context, this.options.cli);

    // Register tree view with settings
    registerTreeView(this.options.context, {
      cli: this.options.cli,
      workspacePath: this.options.workspacePath,
      registerTreeCommands: true,
      settings: this.options.settings,
    });

    // Only show cloud integration prompt if not dismissed
    if (!this.options.settings.cloudNotificationDismissed) {
      showCloudIntegrationPrompt(
        this.options.context,
        this.options.cli,
        this.options.settings
      );
    }
  }

  // getters
  public get context(): vscode.ExtensionContext {
    return this.options.context;
  }

  public get cli(): Cli {
    return this.options.cli;
  }

  public get workspacePath(): string {
    return this.options.workspacePath;
  }
}
