import * as vscode from 'vscode';
import Cli from '../../dagger/dagger';

const COMMAND = 'dagger.version';

export const registerVersionCommand = (
    context: vscode.ExtensionContext,
    cli: Cli
): void => {
    const disposable = vscode.commands.registerCommand(COMMAND, async (): Promise<void> => {
        const progressOptions = {
            title: 'Dagger',
            location: vscode.ProgressLocation.Notification
        };

        await vscode.window.withProgress(progressOptions, async (progress) => {
            progress.report({ message: 'Getting Dagger version...' });
            const result = await cli.run(['version']);

            if (!result.success) {
                vscode.window.showErrorMessage(`Failed to get Dagger version: ${result.stderr}`);
                return;
            }

            // Show the version in an information message
            vscode.window.showInformationMessage(`Dagger Version: ${result.stdout}`);
        });
    });

    context.subscriptions.push(disposable);
};