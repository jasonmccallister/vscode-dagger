import * as vscode from 'vscode';
import { exec } from 'child_process';
import { DaggerSettings } from '../../settings';

const COMMAND = 'dagger.uninstall';

export const registerUninstallCommand = (
    context: vscode.ExtensionContext,
    settings: DaggerSettings
): void => {
    const uninstallCommand = vscode.commands.registerCommand(COMMAND, async () => {
        const installMethod = settings.installMethod;

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

    await new Promise<void>((resolve, reject) => {
        exec(command, (err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });

    vscode.window.showInformationMessage(`Dagger has been uninstalled using ${methodLabel}`);
};
