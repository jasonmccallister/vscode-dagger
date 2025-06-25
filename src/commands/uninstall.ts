import * as vscode from 'vscode';
import { exec } from 'child_process';
import Cli from '../dagger/dagger';

const brewCommand = 'brew uninstall dagger/tap/dagger';
const curlCommand = 'type dagger >/dev/null 2>&1 && rm -rf $(dirname $(which dagger)) || true';

export default function uninstallCommand(context: vscode.ExtensionContext, cli: Cli) {
    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.uninstall', async () => {
            if (!await cli.isInstalled()) {
                vscode.window.showInformationMessage('Dagger is not installed. No action taken.');
                return;
            }

            const response = await vscode.window.showInformationMessage(
                'Are you sure you want to uninstall Dagger?',
                { modal: true },
                'Uninstall',
                'Cancel'
            );

            if (response === 'Uninstall') {
                try {
                    const config = vscode.workspace.getConfiguration('dagger');
                    const installedMethod: string = config.get('installMethod', 'curl');
                    
                    await vscode.window.withProgress({ title: 'Dagger', location: vscode.ProgressLocation.Notification }, async (progress) => {
                        progress.report({ message: 'Uninstalling...' });

                        return new Promise<void>((resolve) => {
                            const command = installedMethod === 'brew' ? brewCommand : curlCommand;
                            exec(command, (error, stdout, stderr) => {
                                if (error) {
                                    vscode.window.showErrorMessage(`Dagger uninstallation failed: ${stderr || error.message}`);
                                    resolve();
                                    return;
                                }
                                resolve();
                            });
                        });
                    });
                    vscode.window.showInformationMessage('Dagger has been uninstalled successfully.');
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to uninstall Dagger: ${error}`);
                }
            }
        })
    );
}