import * as vscode from 'vscode';
import DaggerCli from './cli';
import Commands from './commands';
import { promptCloud } from './actions/cloud';
import { registerDaggerChatCommand } from './chat/participant';
import { registerDaggerChatParticipant } from './chat/provide';
import { DaggerTreeDataProvider } from './tree/provider';
import { collectAndRunFunction } from './utils/function-helpers';

export async function activate(context: vscode.ExtensionContext) {
	console.log('Dagger extension activating...');
	
	const cli = new DaggerCli();

	// Register core commands
	Commands.register(context, "", cli);

	// Register the Dagger tree view
	const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
	const treeDataProvider = new DaggerTreeDataProvider(cli, workspacePath);
	vscode.window.registerTreeDataProvider('daggerTreeView', treeDataProvider);

	// Add command to refresh the tree view
	context.subscriptions.push(
		vscode.commands.registerCommand('dagger.refreshTreeView', () => {
			treeDataProvider.reloadFunctions();
		})
	);

	// Add command to run function from tree view
	context.subscriptions.push(
		vscode.commands.registerCommand('dagger.runFunctionFromTree', async (treeItem: any) => {
			if (treeItem && treeItem.type === 'function') {
				// Use the function ID (original name) instead of display label
				const functionName = treeItem.id || treeItem.label;
				
				try {
					// Get function arguments
					const args = await cli.getFunctionArguments(functionName, workspacePath);
					
					// Use the shared helper to collect arguments and run the function
					await collectAndRunFunction(functionName, args);
				} catch (error) {
					vscode.window.showErrorMessage(`Failed to run function '${functionName}': ${error}`);
				}
			}
		})
	);


	// Show cloud prompt
	promptCloud(context, cli);

	// Check if experimental features are enabled
	const config = vscode.workspace.getConfiguration('dagger');
	const experimentalFeaturesEnabled = config.get<boolean>('experimentalFeatures', false);

	if (experimentalFeaturesEnabled) {
		// Chat functionality
		try {
			// Register dagger chat command for manual searching
			registerDaggerChatCommand(context);
			
			// Register dagger as a chat participant
			registerDaggerChatParticipant(context);
			
			console.log('Dagger experimental chat features registered successfully');
		} catch (error) {
			console.error('Failed to register Dagger chat features:', error);
		}
	} else {
		console.log('Dagger experimental features disabled. Enable in settings to use chat features.');
	}

	// Listen for configuration changes to dynamically enable/disable experimental features
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('dagger.experimentalFeatures')) {
				const newStatus = vscode.workspace.getConfiguration('dagger').get<boolean>('experimentalFeatures', false);
				if (newStatus && !experimentalFeaturesEnabled) {
					vscode.window.showInformationMessage(
						'Experimental features enabled! Please reload the window for chat participant to be available.',
						'Reload Now',
						'Later'
					).then(response => {
						if (response === 'Reload Now') {
							vscode.commands.executeCommand('workbench.action.reloadWindow');
						}
					});
				} else if (!newStatus && experimentalFeaturesEnabled) {
					vscode.window.showInformationMessage(
						'Experimental features disabled. Reload the window to fully disable chat features.',
						'Reload Now',
						'Later'
					).then(response => {
						if (response === 'Reload Now') {
							vscode.commands.executeCommand('workbench.action.reloadWindow');
						}
					});
				}
			}
		})
	);
	
	console.log('Dagger extension activated');
}