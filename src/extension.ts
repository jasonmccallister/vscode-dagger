import * as vscode from 'vscode';
import DaggerCli from './cli';
import Commands from './commands';
import { promptCloud } from './actions/cloud';
import { loadTasks } from './tasks/tasks';
import { collectAndRunFunction } from './utils/function-helpers';

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
				vscode.commands.registerCommand(commandId, async () => {
					const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';
					const args = await cli.getFunctionArguments(fn.name, workspacePath);
					if (!args) {
						vscode.window.showErrorMessage(`Failed to get arguments for function '${fn.name}'`);
						return false;
					}
					
					return collectAndRunFunction(fn.name, args, true);
				})
			);
		});
	}
}