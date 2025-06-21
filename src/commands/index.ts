import * as vscode from 'vscode';
import installCommand from './install';

export default class Commands {
    public static register(context: vscode.ExtensionContext, workspacePath: string) {
        installCommand(context);
    }
}