import * as vscode from 'vscode';
import { exists } from '../executable';
import DaggerCli from '../cli';

export default function versionCommand(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.version', async () => {
            if (!await exists('dagger')) {
                vscode.window.showInformationMessage('Dagger is not installed. No action taken.');
                return;
            }

            await vscode.window.withProgress({ title: 'Dagger', location: vscode.ProgressLocation.Notification }, async (progress) => {
                progress.report({ message: 'Getting Dagger version...' });

                return new Promise<void>((resolve) => {
                    const cli = new DaggerCli();
                    cli.run(['version']).then((result) => {
                        if (result.success) {
                            const versionMatch = result.stdout.match(/v(\d+\.\d+\.\d+)/);
                            const versionNumber = versionMatch ? versionMatch[1] : 'unknown';
                            vscode.window.showInformationMessage(`Dagger version: ${versionNumber}`);
                        } else {
                            vscode.window.showErrorMessage(`Failed to get Dagger version: ${result.stderr}`);
                        }
                        resolve();
                    }).catch((error) => {
                        vscode.window.showErrorMessage(`Error checking Dagger version: ${error}`);
                        resolve();
                    });
                });
            });
        })
    );
}