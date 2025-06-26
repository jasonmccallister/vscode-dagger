import * as vscode from 'vscode';
import Cli from '../dagger/dagger';
import Terminal from '../terminal';

/**
 * Gets the workspace path for the shell command
 * @returns The workspace path or empty string if not available
 */
const getWorkspacePath = (): string => {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
};

export const registerShellCommand = (context: vscode.ExtensionContext): void => {
    const disposable = vscode.commands.registerCommand('dagger.shell', async () => {
        const cli = new Cli();

        const workspacePath = getWorkspacePath();
        cli.setWorkspacePath(workspacePath);

        Terminal.run(
            vscode.workspace.getConfiguration('dagger'),
            ['shell'],
        );
    });

    context.subscriptions.push(disposable);
};