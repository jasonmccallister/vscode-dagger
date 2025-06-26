import * as vscode from 'vscode';
import Cli from '../dagger/dagger';

// Import all command registration functions
import { registerInstallCommand } from './install';
import { registerUpdateCommand } from './update';
import { registerUninstallCommand } from './uninstall';
import { registerVersionCommand } from './version';
import { registerInitCommand } from './init';
import { registerDevelopCommand } from './develop';
import { registerCloudCommand } from './cloud';
import { registerFunctionsCommand } from './functions';
import { registerResetCommand } from './reset';
import { registerShellCommand } from './shell';
import { registerCallCommand } from './call';
import { registerInstallModuleCommand } from './install-module';
import { registerRefreshFunctionsCommand } from './refresh-functions';
import { registerViewFunctionsCommand } from './view-functions';

// Export all command registration functions
export { registerInstallCommand } from './install';
export { registerUpdateCommand } from './update';
export { registerUninstallCommand } from './uninstall';
export { registerVersionCommand } from './version';
export { registerInitCommand } from './init';
export { registerDevelopCommand } from './develop';
export { registerCloudCommand } from './cloud';
export { registerResetCommand } from './reset';
export { registerShellCommand } from './shell';
export { registerCallCommand } from './call';
export { registerInstallModuleCommand } from './install-module';
export { registerRefreshFunctionsCommand } from './refresh-functions';
export { registerViewFunctionsCommand } from './view-functions';

// Function to register all commands when Dagger is installed
export const registerAllCommands = (
    context: vscode.ExtensionContext,
    cli: Cli,
    workspacePath: string
): void => {
    // Register commands with dependency injection (install command is registered separately)
    registerUpdateCommand(context, cli);
    registerUninstallCommand(context, cli);
    registerVersionCommand(context, cli);
    registerInitCommand(context, cli);
    registerDevelopCommand(context, cli, workspacePath);
    registerCloudCommand(context, cli);
    registerFunctionsCommand(context, cli);
    registerResetCommand(context);
    registerShellCommand(context, cli, workspacePath);
    registerCallCommand(context, cli, workspacePath);
    registerInstallModuleCommand(context, cli);
    
    // Register tree view related commands
    registerViewFunctionsCommand(context);
};

// Function to register tree view commands that need a data provider callback
export const registerTreeCommands = (
    context: vscode.ExtensionContext,
    refreshCallback: () => void
): void => {
    registerRefreshFunctionsCommand(context, refreshCallback);
};