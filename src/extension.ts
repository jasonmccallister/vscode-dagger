import * as vscode from 'vscode';
import DaggerCli from './cli/cli';

export function activate(context: vscode.ExtensionContext) {
	const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder is open. Please open a folder or workspace first.');
    }
    const workspace = workspaceFolders[0].uri;

	const cli = new DaggerCli('dagger', workspace);
	context.subscriptions.push(
		vscode.commands.registerCommand('dagger.init', async () => {
			// check if this workspace is already a dagger project
			if (await cli.isDaggerProject()) {
				// show an error message if it is and prompt the user to run the develop command
				

			
				return;
			}

			await cli.run(['init']);
		}),
		vscode.commands.registerCommand('dagger.develop', async () => {
			// check if this workspace is already a dagger project
			if (!await cli.isDaggerProject()) {
				// show an error message if it is and prompt the user to run the init command
				vscode.window.showErrorMessage('This workspace is not a Dagger project. Please run the "Dagger: Init" command to initialize it.');
				return;
			}

			await cli.run(['develop']);
		}),
		vscode.commands.registerCommand('dagger.functions', async () => {
			// check if this workspace is already a dagger project
			if (!await cli.isDaggerProject()) {
				// show an error message if it is and prompt the user to run the init command
				vscode.window.showErrorMessage('This workspace is not a Dagger project. Please run the "Dagger: Init" command to initialize it.');
				return;
			}

			await cli.run(['functions']);
		})
	);
}

export function deactivate() {}
