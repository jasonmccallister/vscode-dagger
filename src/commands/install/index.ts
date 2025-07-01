import * as vscode from 'vscode';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ICON_PATH_BLACK, ICON_PATH_WHITE } from '../../const';

const COMMAND = 'dagger.install';
const execAsync = promisify(exec);
const INSTALL_COMMAND_CURL = 'curl -fsSL https://raw.githubusercontent.com/dagger/dagger/main/install.sh | bash';
const INSTALL_COMMAND_HOMEBREW = 'brew install dagger/tap/dagger';

interface InstallResult {
    isInstalled: boolean;
    hasCorrectBinary: boolean;
    hasHomebrew?: boolean;
    platform: string;
}

export const registerInstallCommand = (context: vscode.ExtensionContext): void => {
    const installCommand = vscode.commands.registerCommand(COMMAND, async (installationMethod?: string) => {
        try {
            const result = await checkInstallation(os.platform());

            if (result.hasCorrectBinary) {
                vscode.window.showInformationMessage('Dagger is already installed and ready to use!');
                return;
            }

            await handleInstallation(result, installationMethod, context);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to check installation: ${error}`);
        }
    });

    context.subscriptions.push(installCommand);
};

const handleInstallation = async (result: InstallResult, installationMethod?: string, context?: vscode.ExtensionContext): Promise<void> => {
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
        case 'brew': {
            command = INSTALL_COMMAND_HOMEBREW;
            methodLabel = 'Homebrew';
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Dagger',
                    cancellable: true
                },
                async (progress, cancellationToken) => {
                    progress.report({ message: `Installing using ${methodLabel}...` });
                    let childProcess: import('child_process').ChildProcess | undefined;
                    try {
                        await new Promise<void>((resolve, reject) => {
                            childProcess = exec(command, (error: any, _stdout: string, stderr: string) => {
                                if (error) {
                                    reject(stderr || error.message);
                                } else {
                                    resolve();
                                }
                            });
                            if (cancellationToken) {
                                cancellationToken.onCancellationRequested(() => {
                                    if (childProcess && !childProcess.killed) {
                                        childProcess.kill();
                                    }
                                    reject('Installation cancelled by user.');
                                });
                            }
                        });
                        vscode.window.showInformationMessage(
                            `Dagger installed successfully! Please reload the window to activate the extension.`,
                            'Reload'
                        ).then((selection) => {
                            if (selection === 'Reload') {
                                vscode.commands.executeCommand('workbench.action.reloadWindow');
                            }
                        });
                    } catch (err: any) {
                        if (err === 'Installation cancelled by user.') {
                            vscode.window.showWarningMessage('Dagger installation was cancelled.');
                        } else {
                            vscode.window.showErrorMessage(`Installation failed: ${err}`);
                        }
                    }
                }
            );
            break;
        }
        case 'curl': {
            // Open a new terminal with the Dagger icon and prefill the sudo install command, but do not run it
            if (!context) {
                vscode.window.showErrorMessage('Unable to open terminal with icon: internal context unavailable. Please contact the extension author.');
                break;
            }
            const terminal = vscode.window.createTerminal({
                name: 'Dagger',
                iconPath: {
                    light: vscode.Uri.joinPath(context.extensionUri, ICON_PATH_BLACK),
                    dark: vscode.Uri.joinPath(context.extensionUri, ICON_PATH_WHITE)
                }
            });
            terminal.show();
            terminal.sendText(`${INSTALL_COMMAND_CURL}`, false);
            break;
        }
        default:
            vscode.window.showErrorMessage('Unknown installation method selected.');
            return;
    }
};

const checkInstallation = async (platform: string): Promise<InstallResult> => {
    // Check if binary exists 
    let hasCorrectBinary = false;
    try {
        const { stdout } = await execAsync('dagger version', { timeout: 5000 });
        hasCorrectBinary = stdout.includes('dagger');
    } catch (error) {
        // dagger binary doesn't exist or failed to execute
        hasCorrectBinary = false;
    }

    // Check if Homebrew is installed (for macOS/Linux)
    let hasHomebrew: boolean | undefined;
    if (platform === 'darwin' || platform === 'linux') {
        try {
            await execAsync('brew --version');
            hasHomebrew = true;
        } catch (error) {
            hasHomebrew = false;
        }
    }

    return {
        isInstalled: hasCorrectBinary,
        hasCorrectBinary,
        hasHomebrew,
        platform
    };
};