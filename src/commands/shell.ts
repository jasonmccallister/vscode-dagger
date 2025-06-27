import * as vscode from 'vscode';
import { executeInTerminal } from '../utils/terminal';

export const registerShellCommand = (
    context: vscode.ExtensionContext,
    workspacePath: string
): void => {
    const disposable = vscode.commands.registerCommand('dagger.shell', async () => {
        executeInTerminal('dagger shell', workspacePath);
    });

    context.subscriptions.push(disposable);
};