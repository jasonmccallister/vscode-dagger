import * as vscode from 'vscode';
import DaggerCli from '../cli';
import { askToInstall } from '../actions/install';
import { Terminal } from '../terminal';
import { initProjectCommand } from '../actions/init';

export default function callCommand(context: vscode.ExtensionContext, workspace: string, cli: DaggerCli) {
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

                // Separate required and optional arguments
                const requiredArgs = args.filter(arg => arg.required);
                const optionalArgs = args.filter(arg => !arg.required);

                // Show a quick pick for optional arguments
                let selectedOptionalArgs: typeof optionalArgs = [];
                if (optionalArgs.length > 0) {
                    const argsPicks = optionalArgs.map(arg => ({
                        label: `${arg.name} (${arg.type})`,
                        description: 'Optional',
                        detail: `Type: ${arg.type}`
                    }));
                    const selected = await vscode.window.showQuickPick(argsPicks, {
                        placeHolder: 'Select optional arguments to provide values for',
                        canPickMany: true
                    });
                    if (selected) {
                        const selectedNames = selected.map(arg => arg.label.split(' ')[0]);
                        selectedOptionalArgs = optionalArgs.filter(arg => selectedNames.includes(arg.name));
                    }
                }

                // Combine required and selected optional arguments
                const allSelectedArgs = [...requiredArgs, ...selectedOptionalArgs];
                const argValues: string[] = [];
                for (const arg of allSelectedArgs) {
                    const value = await vscode.window.showInputBox({
                        prompt: `Enter value for --${arg.name} (${arg.type})${arg.required ? ' [required]' : ''}`,
                        ignoreFocusOut: true,
                        validateInput: input => arg.required && !input ? 'This value is required.' : undefined
                    });
                    if (arg.required && !value) {
                        vscode.window.showErrorMessage(`Value required for argument --${arg.name}`);
                        return;
                    }
                    if (value) {
                        argValues.push(`--${arg.name}`);
                        argValues.push(value);
                    }
                }

                progress.report({ message: `Calling function: ${pick.label}` });

                const commands = [pick.label, ...argValues];

                Terminal.run(
                    vscode.workspace.getConfiguration('dagger'),
                    ['call', ...commands],
                );
            });
        })
    );
}
