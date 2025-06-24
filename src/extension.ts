import * as vscode from 'vscode';
import DaggerCli from './cli';
import Commands from './commands';
import { promptCloud } from './actions/cloud';
import { loadTasks } from './tasks/tasks';
import { Terminal } from './terminal';

export async function activate(context: vscode.ExtensionContext) {
	const cli = new DaggerCli();

	Commands.register(context, "", cli);

	promptCloud(context, cli);

	loadTasks(cli);

	// Register a command handler for each Dagger function 
	const functions = await cli.functionsList(vscode.workspace.workspaceFolders?.[0].uri.fsPath || '');
	if (functions) {
		functions.forEach(fn => {
			const commandId = `dagger.runFunction.${fn.name}`;
			context.subscriptions.push(
				vscode.commands.registerCommand(commandId, async (functionName: string, args: any[], workspacePath: string) => {
					// For each argument, collect a value from the user
					const argValues: Record<string, string> = {};
					for (const arg of args) {
						const value = await vscode.window.showInputBox({
							prompt: `Enter value for --${arg.name} (${arg.type})${arg.required ? ' [required]' : ''}`,
							ignoreFocusOut: true,
							validateInput: input => arg.required && !input ? 'This value is required.' : undefined
						});

						if (arg.required && !value) {
							vscode.window.showErrorMessage(`Value required for argument --${arg.name}`);
							return false; // Don't proceed with the task
						}

						if (value) {
							argValues[arg.name] = value;
						}
					}

					// Build the command as an array of arguments
					const commandArgs = ['call', functionName];

					// Add all collected arguments to the command array
					Object.entries(argValues).forEach(([name, value]) => {
						commandArgs.push(`--${name}`);
						commandArgs.push(value);
					});

					Terminal.run(
						vscode.workspace.getConfiguration('dagger'),
						commandArgs,
						true // Force show the terminal when running function tasks
					);
				})
			);
		});
	}
}