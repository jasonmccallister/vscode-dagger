import * as vscode from 'vscode';
import DaggerCli from '../cli';

export default function shellCommand(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.shell', async () => {
            const cli = new DaggerCli();
            if (!(await cli.isDaggerProject())) {
                vscode.window.showErrorMessage('This workspace is not a Dagger project. Please run the "Dagger: Init" command to initialize it.');
                return;
            }
cli.setWorkspacePath(vscode.workspace.workspaceFolders?.[0].uri.fsPath || '');

            // Open a terminal with the Dagger CLI
            const terminal = vscode.window.createTerminal({
                name: 'Dagger',
            });
            terminal.show();
            terminal.sendText('dagger shell', true);
        })
    );
}