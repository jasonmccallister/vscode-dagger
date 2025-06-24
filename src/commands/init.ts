import * as vscode from 'vscode';
import DaggerCli from '../cli';
import { askToInstall } from '../actions/install';

export default function initCommand(context: vscode.ExtensionContext, cli: DaggerCli) {
    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.init', async () => {
            // Ensure Dagger CLI is installed
            if (!await cli.isInstalled()) {
                askToInstall();
                return;
            }

            // Check if this workspace is already a Dagger project
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
                const workspaceFolders = vscode.workspace.workspaceFolders;
                const cwd = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : process.cwd();
                const result = await cli.run(['init', '--sdk', sdkChoice.value], { cwd });
                if (!result.success) {
                    vscode.window.showErrorMessage(`Failed to initialize Dagger project: ${result.stderr}`);
                    return;
                }

                // Ask the user if they want to run the functions command
                const choice = await vscode.window.showInformationMessage(
                    `Dagger project initialized with ${sdkChoice.label} SDK! Would you like to see the available functions?`,
                    { modal: true },
                    'Yes',
                    'No'
                );

                if (choice === 'Yes') {
                    // call the vscode dagger.functions command
                    await vscode.commands.executeCommand('dagger.functions');
                }
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to initialize Dagger project: ${error.message || error}`);
            }
        })
    );
}