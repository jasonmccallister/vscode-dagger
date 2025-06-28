import * as vscode from 'vscode';
import { exec } from 'child_process';

export const registerUninstallCommand = (context: vscode.ExtensionContext): void => {
    const uninstallCommand = vscode.commands.registerCommand('dagger.uninstall', async () => {
        const config = vscode.workspace.getConfiguration('dagger');
        const installMethod = config.get<string>('installMethod');

        if (!installMethod) {
            vscode.window.showErrorMessage('No installation method found in settings. Unable to proceed with uninstallation.');
            return;
        }

        const confirmUninstall = await vscode.window.showWarningMessage(
            'Are you sure you want to uninstall Dagger?',
            { modal: true },
            'Yes'
        );

        if (confirmUninstall !== 'Yes') {
            return; // User cancelled
        }

        try {
            await handleUninstallation(installMethod);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to uninstall Dagger: ${error}`);
        }
    });

    context.subscriptions.push(uninstallCommand);
};

const handleUninstallation = async (installMethod: string): Promise<void> => {
    let command: string;
    let methodLabel: string;

    switch (installMethod) {
        case 'brew':
            command = 'brew uninstall dagger/tap/dagger';
            methodLabel = 'Homebrew';
            break;
        case 'curl':
            command = 'rm -rf ~/.dagger';
            methodLabel = 'curl script';
            break;
        default:
            vscode.window.showErrorMessage('Unknown installation method found in settings. Unable to proceed with uninstallation.');
            return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Dagger',
            cancellable: true
        },
        async (progress) => {
            progress.report({ message: `Uninstalling using ${methodLabel}...` });
            try {
                await new Promise<void>((resolve, reject) => {
                    exec(command, (error: any, _stdout: string, stderr: string) => {
                        if (error) {
                            reject(stderr || error.message);
                        } else {
                            resolve();
                        }
                    });
                });
                vscode.window.showInformationMessage('Dagger uninstalled successfully!');

                // Deregister the extension after uninstallation
                deactivateExtension();
            } catch (err: any) {
                vscode.window.showErrorMessage(`Uninstallation failed: ${err}`);
            }
        }
    );
};

const deactivateExtension = (): void => {
    // Logic to deactivate the extension features
    vscode.commands.executeCommand('dagger.deactivate');
};