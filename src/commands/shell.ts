import * as vscode from 'vscode';
import Cli from '../dagger/dagger';
import { askToInstall } from '../actions/install';
import Terminal from '../terminal';

/**
 * Gets the workspace path for the shell command
 * @returns The workspace path or empty string if not available
 */
const getWorkspacePath = (): string => {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
};

export default function shellCommand(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand('dagger.shell', async () => {
        const cli = new Cli();

        // Ensure Dagger CLI is installed
        if (!await cli.isInstalled()) {
            await askToInstall();
            return;
        }

        const workspacePath = getWorkspacePath();
        cli.setWorkspacePath(workspacePath);

        Terminal.run(
            vscode.workspace.getConfiguration('dagger'),
            ['shell'],
        );
    });

    context.subscriptions.push(disposable);
}