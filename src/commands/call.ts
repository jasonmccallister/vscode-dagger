import * as vscode from 'vscode';
import DaggerCli from '../cli';
import { askToInstall } from '../actions/install-prompt';

export default function callCommand(context: vscode.ExtensionContext, workspace: string, cli: DaggerCli) {
    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.call', async () => {
            if (!await cli.isInstalled()) {
                askToInstall();
                return;
            }

            if (!(await cli.isDaggerProject())) {
                vscode.window.showErrorMessage('This workspace is not a Dagger project. Please run the "Dagger: Init" command to initialize it.');
                return;
            }

            // if workspace is not set, use the current workspace folder or cwd
            if (!workspace) {
                vscode.window.showInformationMessage('No workspace path set. Using current workspace or cwd.');
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

                // Show a quick pick for the function arguments
                const argsPicks = args.map(arg => ({
                    label: `${arg.name} (${arg.type})`,
                    description: arg.required ? 'Required' : 'Optional',
                    detail: `Type: ${arg.type}`
                }));

                const selectedArgs = await vscode.window.showQuickPick(argsPicks, {
                    placeHolder: 'Select function arguments (optional)',
                    canPickMany: true
                });
                if (!selectedArgs) {
                    return;
                }

                
                const selectedArgNames = selectedArgs.map(arg => arg.label.split(' ')[0]); // Extract argument names

                progress.report({ message: `Calling function: ${pick.label}` });
                const callResult = await cli.run(['call', pick.label, ...selectedArgNames]);
                if (callResult.success) {
                    vscode.window.showInformationMessage(`Function '${pick.label}' called successfully.`);
                } else {
                    vscode.window.showErrorMessage(`Failed to call function '${pick.label}': ${callResult.stderr}`);
                }
            });
        })
    );
}