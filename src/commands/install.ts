import * as vscode from 'vscode';
import { checkInstallation, InstallResult } from '../utils/installation';
import * as os from 'os';
import { exec } from 'child_process';
import { INSTALL_COMMAND_CURL, INSTALL_COMMAND_HOMEBREW } from '../const';

export const registerInstallCommand = (context: vscode.ExtensionContext): void => {
    const installCommand = vscode.commands.registerCommand('dagger.install', async (installationMethod?: string) => {
        try {
            const result = await checkInstallation(os.platform());

            if (result.hasCorrectBinary) {
                vscode.window.showInformationMessage('Dagger is already installed and ready to use!');
                return;
            }

            await handleInstallation(result, installationMethod);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to check installation: ${error}`);
        }
    });

    context.subscriptions.push(installCommand);
};

const handleInstallation = async (result: InstallResult, installationMethod?: string): Promise<void> => {
    const config = vscode.workspace.getConfiguration('dagger');

    let command: string;
    let methodLabel: string;

    if (installationMethod) {
        switch (installationMethod) {
            case 'brew':
                command = INSTALL_COMMAND_HOMEBREW;
                methodLabel = 'Homebrew';
                break;
            case 'curl':
                command = INSTALL_COMMAND_CURL;
                methodLabel = 'curl script';
                break;
            default:
                vscode.window.showErrorMessage('Unknown installation method provided.');
                return;
        }
    } else {
        // Determine available installation methods
        const installMethods: string[] = [];
        const installLabels: string[] = [];

        if (result.hasHomebrew && (result.platform === 'darwin' || result.platform === 'linux')) {
            installMethods.push('brew');
            installLabels.push('Install using Homebrew (recommended)');
        }

        // Always add curl as an option
        installMethods.push('curl');
        installLabels.push('Install using curl script');

        if (installMethods.length === 0) {
            vscode.window.showErrorMessage('No suitable installation method found for your platform.');
            return;
        }

        // Show installation options to user
        const selectedMethod = await vscode.window.showQuickPick(
            installLabels.map((label, index) => ({
                label,
                value: installMethods[index]
            })),
            {
                placeHolder: 'Dagger is not installed. Please select an installation method:',
                canPickMany: false
            }
        );

        if (!selectedMethod) {
            return; // User cancelled
        }

        installationMethod = selectedMethod.value;
    }

    // Save the selected method to configuration
    await config.update('installMethod', installationMethod, vscode.ConfigurationTarget.Global);

    // Show instructions based on selected method
    switch (installationMethod) {
        case 'brew':
            command = INSTALL_COMMAND_HOMEBREW;
            methodLabel = 'Homebrew';
            break;
        case 'curl':
            command = INSTALL_COMMAND_CURL;
            methodLabel = 'curl script';
            break;
        default:
            vscode.window.showErrorMessage('Unknown installation method selected.');
            return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Dagger',
            cancellable: true
        },
        async (progress) => {
            progress.report({ message: `Installing using ${methodLabel}...` });
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

                // prompt the user to reload the the window to activate the extension
                vscode.window.showInformationMessage(
                    `Dagger installed successfully! Please reload the window to activate the extension.`,
                    'Reload'
                ).then((selection) => {
                    if (selection === 'Reload') {
                        vscode.commands.executeCommand('workbench.action.reloadWindow');
                    }
                });
            } catch (err: any) {
                vscode.window.showErrorMessage(`Installation failed: ${err}`);
            }
        }
    );
};
