import * as vscode from 'vscode';
import { registerInstallCommand } from './install';
import Cli from '../dagger';
import { registerCallCommand } from './call';
import { registerCloudCommand } from './cloud';
import { registerDevelopCommand } from './develop';
import { registerFunctionsCommand } from './functions';
import { registerInitCommand } from './init';
import { registerInstallModuleCommand } from './install-module';
import { registerResetCommand } from './reset';
import { registerSaveTaskCommand } from './save-task';
import { registerShellCommand } from './shell';
import { registerUninstallCommand } from './uninstall';
import { registerUpdateCommand } from './update';
import { registerVersionCommand } from './version';
import { promptCloud } from '../actions/cloud';
import { registerTreeView } from '../tree/provider';

type Options = {
    context: vscode.ExtensionContext;
    cli: Cli;
    workspacePath: string;
}

export default class CommandManager {
    static options: Options;

    constructor(private options: Options) { }

    public register(all: boolean = true) {
        if (!all) {
            registerInstallCommand(this.options.context);
            return;
        }

        // Register all commands
        registerUpdateCommand(this.options.context, this.options.cli);
        registerUninstallCommand(this.options.context);
        registerVersionCommand(this.options.context, this.options.cli);
        registerInitCommand(this.options.context, this.options.cli);
        registerDevelopCommand(this.options.context, this.options.cli, this.options.workspacePath);
        registerCloudCommand(this.options.context, this.options.cli);
        registerFunctionsCommand(this.options.context);
        registerResetCommand(this.options.context);
        registerShellCommand(this.options.context, this.options.workspacePath);
        registerCallCommand(this.options.context, this.options.cli, this.options.workspacePath);
        registerInstallModuleCommand(this.options.context, this.options.cli);
        registerSaveTaskCommand(this.options.context, this.options.cli, this.options.workspacePath);

        // Register tree view for environments with CLI and workspace path
        registerTreeView(this.options.context, { cli: this.options.cli, workspacePath: this.options.workspacePath, registerTreeCommands: true });

        // Show cloud setup notification if appropriate
        promptCloud(this.options.context, this.options.cli);
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