import * as vscode from 'vscode';
import Cli from '../cli';
import { askToInstall } from '../actions/install';
import { initProjectCommand } from '../actions/init';
import { collectAndRunFunction } from '../utils/function-helpers';

export default function callCommand(context: vscode.ExtensionContext, workspace: string, cli: Cli) {
    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.call', async () => {
            if (!await cli.isInstalled()) {
                return askToInstall();
            }

            if (!(await cli.isDaggerProject())) {
                return initProjectCommand();
            }

            // if workspace is not set, use the current workspace folder or cwd
            if (!workspace) {
                console.log('No workspace path set. Using current workspace or cwd.');
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders && workspaceFolders.length > 0) {
                    workspace = workspaceFolders[0].uri.fsPath;
                } else {
                    workspace = process.cwd();
                }
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Dagger: Loading functions',
                cancellable: false
            }, async (progress) => {
                progress.report({ message: 'Running `dagger functions`...' });
                const functions = await cli.functionsList(workspace);
                if (functions.length === 0) {
                    vscode.window.showInformationMessage('No Dagger functions found in this project.');
                    return;
                }

                progress.report({ message: 'Select a function to call...' });
                const pick = await vscode.window.showQuickPick(
                    functions.map(fn => ({
                        label: fn.name,
                        description: fn.description
                    })),
                    {
                        placeHolder: 'Select a function to call'
                    }
                );

                if (!pick) {
                    return;
                }

                // get the selected function arguments
                const args = await cli.getFunctionArguments(pick.label, workspace);
                if (!args) {
                    vscode.window.showErrorMessage(`Failed to get arguments for function '${pick.label}'`);
                    return;
                }

                // Use the shared helper to collect arguments and run the function
                await collectAndRunFunction(pick.label, args);
            });
        })
    );
}
