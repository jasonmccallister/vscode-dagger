import * as vscode from 'vscode';
import installCommand from './install';
import uninstallCommand from './uninstall';
import versionCommand from './version';
import updateCommand from './update';
import initCommand from './init';
import developCommand from './develop';
import cloudCommand from './cloud';
import functionsCommand from './functions';
import Cli from '../dagger/dagger';
import resetCommand from './reset';
import shellCommand from './shell';
import callCommand from './call';
import installModuleCommand from './install-module';

export default class Commands {
    public static register(
        context: vscode.ExtensionContext,
        workspacePath: string,
        cli: Cli,
    ): void {
        // Register all command handlers
        callCommand(context, workspacePath, cli);
        cloudCommand(context, cli);
        developCommand(context, cli);
        functionsCommand(context, cli);
        initCommand(context, cli);
        installCommand(context, cli);
        installModuleCommand(context, cli);
        resetCommand(context);
        shellCommand(context);
        uninstallCommand(context, cli);
        updateCommand(context, cli);
        versionCommand(context, cli);
    }
}