import * as vscode from 'vscode';
import DaggerCli from '../cli';
import { askToInstall } from '../actions/install';
import { Terminal } from '../terminal';

export default function shellCommand(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.shell', async () => {
            const cli = new DaggerCli();

            // Ensure Dagger CLI is installed
            if (!await cli.isInstalled()) {
                askToInstall();
                return;
            }

            cli.setWorkspacePath(vscode.workspace.workspaceFolders?.[0].uri.fsPath || '');

            Terminal.run(
                vscode.workspace.getConfiguration('dagger'),
                ['shell'],
                true, // Force show the terminal
            );
        })
    );
}