import * as vscode from 'vscode';
import Cli from './dagger/dagger';
import Commands from './commands';
import { promptCloud } from './actions/cloud';
import { registerChatCommand } from './chat/participant';
import { registerProvider } from './chat/provider';
import { DataProvider } from './tree/provider';
import { collectAndRunFunction } from './utils/function-helpers';

interface ExtensionApi {
	cli: Cli;
}

interface TreeItem {
	id?: string;
	label: string;
	type: string;
}

export const activate = async (context: vscode.ExtensionContext): Promise<ExtensionApi> => {
	console.log('Dagger extension activating...');

	const cli = new Cli();

	// Register core commands
	Commands.register(context, '', cli);

	// Register the Dagger tree view
	const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
	const treeDataProvider = new DataProvider(cli, workspacePath);
	vscode.window.registerTreeDataProvider('daggerTreeView', treeDataProvider);

	// Add command to refresh the tree view
	const refreshCommand = vscode.commands.registerCommand('dagger.refreshTreeView', () => {
		treeDataProvider.reloadFunctions();
	});
	context.subscriptions.push(refreshCommand);

	// Add command to run function from tree view
	const runFunctionCommand = vscode.commands.registerCommand(
		'dagger.runFunctionFromTree',
		async (treeItem: TreeItem) => {
			if (treeItem?.type === 'function') {
				// Use the function ID (original name) instead of display label
				const functionName = treeItem.id ?? treeItem.label;

				try {
					// Get function arguments
					const args = await cli.getFunctionArguments(functionName, workspacePath);

					// Use the shared helper to collect arguments and run the function
					await collectAndRunFunction(functionName, args);
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					vscode.window.showErrorMessage(`Failed to run function '${functionName}': ${errorMessage}`);
				}
			}
		}
	);
	context.subscriptions.push(runFunctionCommand);


	// Show cloud prompt
	promptCloud(context, cli);

	// Check if experimental features are enabled
	const config = vscode.workspace.getConfiguration('dagger');
	const experimentalFeaturesEnabled = config.get<boolean>('experimentalFeatures', false);

	if (experimentalFeaturesEnabled) {
		try {
			// Register dagger chat command for manual searching
			registerChatCommand(context);

			// Register dagger as a chat participant
			registerProvider(context);

			console.log('Dagger experimental chat features registered successfully');
		} catch (error) {
			console.error('Failed to register Dagger chat features:', error);
		}
	} else {
		console.log('Dagger experimental features disabled. Enable in settings to use chat features.');
	}

	// Listen for configuration changes to dynamically enable/disable experimental features
	const configChangeListener = vscode.workspace.onDidChangeConfiguration((e) => {
		if (e.affectsConfiguration('dagger.experimentalFeatures')) {
			const newStatus = vscode.workspace.getConfiguration('dagger').get<boolean>('experimentalFeatures', false);
			const handleResponse = (response?: string) => {
				if (response === 'Reload Now') {
					vscode.commands.executeCommand('workbench.action.reloadWindow');
				}
			};

			if (newStatus && !experimentalFeaturesEnabled) {
				vscode.window.showInformationMessage(
					'Experimental features enabled! Please reload the window for chat participant to be available.',
					'Reload Now',
					'Later'
				).then(handleResponse);
			} else if (!newStatus && experimentalFeaturesEnabled) {
				vscode.window.showInformationMessage(
					'Experimental features disabled. Reload the window to fully disable chat features.',
					'Reload Now',
					'Later'
				).then(handleResponse);
			}
		}
	});
	context.subscriptions.push(configChangeListener);

	console.log('Dagger extension activated');

	// Return API
	return { cli };
};