import * as vscode from 'vscode';
import DaggerCli from './cli';
import Commands from './commands';
import { promptCloud } from './actions/cloud';
import { loadTasks } from './tasks/tasks';

export async function activate(context: vscode.ExtensionContext) {
	const cli = new DaggerCli();

	Commands.register(context, "", cli);

	promptCloud(context, cli);

	loadTasks(cli);

	// Register a task execution handler for Dagger tasks
	context.subscriptions.push(
		vscode.tasks.onDidStartTask(async e => {
			const task = e.execution.task;
			if (task.definition.type === 'dagger' && task.definition.function) {
				// @ts-ignore - Access our custom execution function
				if (typeof task.runTaskCommand === 'function') {
					// Execute our custom prompt flow instead of the default execution
					vscode.commands.executeCommand('workbench.action.terminal.kill');
					// @ts-ignore
					const success = await task.runTaskCommand();
					if (!success) {
						vscode.window.showErrorMessage(`Failed to run Dagger task: ${task.name}`);
					}
				}
			}
		})
	);
}