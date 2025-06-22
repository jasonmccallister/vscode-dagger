import * as vscode from 'vscode';
import DaggerCli from '../cli';

export default function developCommand(context: vscode.ExtensionContext) {
    const cli = new DaggerCli();

    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.develop', async () => {
            if (!await cli.isInstalled()) {
                return;
            }

            // check if this workspace is already a dagger project
            if (!await cli.isDaggerProject()) {
                // show an error message if it is and ask the user to run the init command
                // Ask the user if they want to run the functions command
                const choice = await vscode.window.showErrorMessage(
                    `This workspace is not a Dagger project. Please run the "Dagger: Init" command to initialize it.`,
                    { modal: true },
                    'Run Init',
                    'No'
                );

                if (choice === 'Run Init') {
                    // Open a terminal and run the dagger init command
                    const terminal = vscode.window.createTerminal('Dagger');
                    terminal.sendText('dagger init');
                    terminal.show();
                }

                return;
            }

            cli.run(['develop'])
                .then(() => {
                    vscode.window.showInformationMessage('Dagger is now in development mode.');
                })
                .catch((error) => {
                    vscode.window.showErrorMessage(`Failed to start Dagger development mode: ${error.message}`);
                });
        })
    );
}