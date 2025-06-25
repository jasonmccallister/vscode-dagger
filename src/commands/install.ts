import * as vscode from 'vscode';
import Cli from '../dagger/dagger';
import { exists } from '../executable';
import { exec } from 'child_process';

const homebrewOption = 'Use Homebrew (recommended)';
const curlOption = 'Use curl script';
const brewInstallCommand = 'brew install dagger/tap/dagger';
const curlInstallCommand = 'curl -fsSL https://dl.dagger.io/dagger/install.sh | BIN_DIR=$HOME/.local/bin sh';

// make a custom type for install method
type InstallMethod = 'brew' | 'curl' | '';

export default function installCommand(context: vscode.ExtensionContext, cli: Cli) {
    // Register the install command
    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.install', async () => {
            if (await cli.isInstalled()) {
                vscode.window.showInformationMessage('Dagger is already installed.');
                return;
            }

            // Get current install method preference from settings
            const config = vscode.workspace.getConfiguration('dagger');
            let defaultInstallMethod: InstallMethod = config.get('installMethod', '');

            // Check if user is on macOS and has brew installed first
            let installMethod: InstallMethod = defaultInstallMethod;
            let installPromptMessage = 'Dagger is not installed. Would you like to install it now?';
            let installOptions = ['Install', 'Cancel'];

            // brew is available on macOS and Linux
            if (process.platform === 'darwin' || process.platform === 'linux') {
                if (await exists('brew')) {
                    // If no preference is set (empty string), show both options
                    if (defaultInstallMethod === '') {
                        installOptions = [homebrewOption, curlOption];
                    } else {
                        // Use the preferred method from settings as default, but still show options
                        const preferredOption = defaultInstallMethod === 'brew' ? homebrewOption : curlOption;
                        const alternateOption = defaultInstallMethod === 'brew' ? curlOption : homebrewOption;
                        installOptions = [preferredOption, alternateOption];
                    }
                } else {
                    // Brew not available, only show curl option if no preference or preference is curl
                    if (defaultInstallMethod === '' || defaultInstallMethod === 'curl') {
                        installOptions = ['Install (curl)', 'Cancel'];
                    }
                }
            } else {
                // Not macOS/Linux, only curl is available
                installOptions = ['Install (curl)', 'Cancel'];
            }

            const installResponse = await vscode.window.showInformationMessage(
                installPromptMessage,
                { modal: true },
                ...installOptions
            );

            if (installResponse === 'Cancel' || !installResponse) {
                vscode.window.showInformationMessage('Installation cancelled. You can install Dagger later by running the "Dagger: Install CLI" command.');
                return;
            }

            // Determine install method based on response
            if (installResponse === homebrewOption) {
                installMethod = 'brew';
            } else if (installResponse === curlOption) {
                installMethod = 'curl';
            } else if (installResponse === 'Install (curl)') {
                installMethod = 'curl';
            } else if (installResponse === 'Install') {
                // If defaultInstallMethod is empty, default to curl as fallback
                installMethod = defaultInstallMethod === '' ? 'curl' : defaultInstallMethod;
            }

            // Update the setting with the user's choice (only if they made a specific choice and no preference was set)
            if (defaultInstallMethod === '' && (installResponse === homebrewOption || installResponse === curlOption)) {
                await config.update('installMethod', installMethod, vscode.ConfigurationTarget.Global);
            }

            let installCommand: string;
            if (installMethod === 'brew') {
                installCommand = brewInstallCommand;
            } else {
                installCommand = curlInstallCommand;
            }

            await vscode.window.withProgress({ title: 'Dagger', location: vscode.ProgressLocation.Notification }, async (progress) => {
                progress.report({ message: 'Running installation command...' });

                return new Promise<void>((resolve) => {
                    exec(installCommand, (error, stdout, stderr) => {
                        if (error) {
                            vscode.window.showErrorMessage(`Dagger installation failed: ${stderr || error.message}`);
                            resolve();
                            return;
                        }
                        vscode.window.showInformationMessage(`Dagger installation completed using ${installMethod}.`);
                        resolve();
                    });
                });
            });

            // Show option to verify installation after a delay
            setTimeout(async () => {
                const verifyResponse = await vscode.window.showInformationMessage(
                    'Installation command has been executed. Would you like to verify the installation?',
                    'Verify',
                    'Later'
                );

                if (verifyResponse === 'Verify') {
                    if (await exists('dagger')) {
                        // get the version of dagger
                        const version = await new Cli().run(['version']);
                        // parse the output (example dagger v0.18.10 (docker-image://registry.dagger.io/engine:v0.18.10) darwin/arm64)to only the version
                        const versionMatch = version.stdout.match(/v(\d+\.\d+\.\d+)/);
                        const versionNumber = versionMatch ? versionMatch[1] : 'unknown';
                        vscode.window.showInformationMessage(`✅ Dagger v${versionNumber} installed!`);
                    } else {
                        vscode.window.showWarningMessage('⚠️ Dagger was not found. Please check the output for any errors and ensure your PATH is updated.');
                    }
                }
            }, 8000); // Wait 8 seconds for brew (slower than curl)
        })
    );
}