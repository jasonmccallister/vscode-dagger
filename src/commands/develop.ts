import * as vscode from 'vscode';
import DaggerCli from '../cli';
import { askToInstall } from '../actions/install-prompt';

export default function developCommand(context: vscode.ExtensionContext, cli: DaggerCli) {
    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.develop', async () => {
            if (!await cli.isInstalled()) {
                askToInstall();
                return;
            }

            // if workspace is not set, use the current workspace folder or cwd
            let workspace: string;

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                workspace = workspaceFolders[0].uri.fsPath;
            } else {
                workspace = process.cwd();
            }

            // check if this workspace is already a dagger project
            if (!await cli.isDaggerProject()) {
                // show an error message if it is and ask the user to run the init command
                // Ask the user if they want to run the functions command
                const choice = await vscode.window.showErrorMessage(
                    `This workspace is not a Dagger project. Please run the "Dagger: Init" command to initialize it.`,
                    { modal: true },
                    'Run Init',
                    'No'
                );

                if (choice === 'Run Init') {
                    // Open a terminal and run the dagger init command
                    const terminal = vscode.window.createTerminal('Dagger');
                    terminal.sendText('dagger init');
                    terminal.show();
                }

                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Dagger: Running develop',
                cancellable: false
            }, async (progress) => {
                progress.report({ message: 'Running `dagger develop`...' });
                const result = await cli.run(['develop'], { cwd: workspace });
                if (!result.success) {
                    vscode.window.showErrorMessage(`Failed to run dagger develop`);
                    console.error(`Dagger development command failed: ${result.stderr}`);
                    return;
                }
            });
        })
    );
}