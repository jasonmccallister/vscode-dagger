import * as vscode from 'vscode';
import DaggerCli from '../cli';

export default function versionCommand(context: vscode.ExtensionContext, cli: DaggerCli) {
    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.version', async () => {
            if (!await cli.isInstalled()) {
                vscode.window.showInformationMessage('Dagger is not installed. No action taken.');
                return;
            }

            await vscode.window.withProgress({ title: 'Dagger', location: vscode.ProgressLocation.Notification }, async (progress) => {
                progress.report({ message: 'Getting Dagger version...' });
                const result = await cli.run(['version']);
                if (!result.success) {
                    vscode.window.showErrorMessage(`Failed to get Dagger version: ${result.stderr}`);
                    return;
                }

                // Show the version in an information message
                vscode.window.showInformationMessage(`Dagger Version: ${result.stdout}`);
            });
        })
    );
}