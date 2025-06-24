import * as vscode from 'vscode';
import DaggerCli from './cli';
import Commands from './commands';
import { promptCloud } from './actions/cloud';
import { loadTasks } from './tasks/tasks';
import { collectAndRunFunction } from './utils/function-helpers';
import { FunctionArgument } from './cli';

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
				vscode.commands.registerCommand(commandId, async (functionName?: string, args?: FunctionArgument[], workspacePath?: string) => {
					// If parameters are passed directly (from a task), use them
					const fnName = functionName || fn.name;
					const wsPath = workspacePath || vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';

					// If args aren't passed in, fetch them
					let fnArgs = args;
					if (!fnArgs) {
						fnArgs = await cli.getFunctionArguments(fnName, wsPath);
						if (!fnArgs) {
							vscode.window.showErrorMessage(`Failed to get arguments for function '${fnName}'`);
							return false;
						}
					}

					return collectAndRunFunction(fnName, fnArgs, true);
				})
			);
		});
	}
}