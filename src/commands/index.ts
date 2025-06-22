import * as vscode from 'vscode';
import installCommand from './install';
import uninstallCommand from './uninstall';
import versionCommand from './version';
import initCommand from './init';
import developCommand from './develop';
import cloudCommand from './cloud';

export default class Commands {
    public static register(context: vscode.ExtensionContext, workspacePath: string) {
        cloudCommand(context);
        developCommand(context);
        initCommand(context);
        installCommand(context);
        uninstallCommand(context);
        versionCommand(context);
    }
}