import * as vscode from 'vscode';
import Cli from '../dagger/dagger';
import Terminal from '../terminal';

export const registerShellCommand = (
    context: vscode.ExtensionContext,
    cli: Cli,
    workspacePath: string
): void => {
    const disposable = vscode.commands.registerCommand('dagger.shell', async () => {
        cli.setWorkspacePath(workspacePath);

        Terminal.run(
            vscode.workspace.getConfiguration('dagger'),
            ['shell'],
        );
    });

    context.subscriptions.push(disposable);
};