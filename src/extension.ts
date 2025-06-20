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
				// show an error message if it is and prompt the user to run the develop command or ignore
				const choice = await vscode.window.showErrorMessage(
					'This workspace is already a Dagger project. Do you want to run the "Dagger: Develop" command instead?',
					{ modal: true },
					'Yes',
					'No'
				);

				if (choice === 'Yes') {
					await cli.run(['develop']);
				} else {
					// User chose to ignore, do nothing
					vscode.window.showInformationMessage('You can run the "Dagger: Develop" command to start developing your Dagger project.');
				}
				// return early to avoid running the init command againform


				return;
			}

			// make an options list with the available SDKs using the label and value properties
			// the label is the display name of the sdk and the value is the same but lower case
			const options = [
				{ label: 'Go', value: 'go' },
				{ label: 'TypeScript', value: 'typescript' },
				{ label: 'PHP', value: 'php' },
				{ label: 'Python', value: 'python' },
				{ label: 'Java', value: 'java' },
			];

			const sdkChoice = await vscode.window.showQuickPick(options, { placeHolder: 'Select the SDK to use' });

			if (!sdkChoice) {
				// User cancelled the selection
				return;
			}

			// run the init command with the selected sdk
			try {
				await cli.run(['init', '--sdk', sdkChoice.value]);
				vscode.window.showInformationMessage(`Dagger project initialized with ${sdkChoice.label} SDK`);
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to initialize Dagger project: ${error}`);
			}
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

export function deactivate() { }
