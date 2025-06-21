import * as vscode from 'vscode';
import DaggerCli from '../cli';
import { exists } from '../executable';

const homebrewOption = 'Use Homebrew (recommended)';
const curlOption = 'Use curl script';
const brewInstallCommand = 'brew install dagger/tap/dagger';
const curlInstallCommand = 'curl -fsSL https://dl.dagger.io/dagger/install.sh | BIN_DIR=$HOME/.local/bin sh';

// make a custom type for install method
type InstallMethod = 'brew' | 'curl' | '';

async function isInstalled(): Promise<boolean> {
    return await (new DaggerCli()).isInstalled();
}

export default function installCommand(context: vscode.ExtensionContext) {
    // Register the install command
    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.install', async () => {
            if (!await isInstalled()) {
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
                    vscode.window.showInformationMessage('Installation cancelled. You can install Container Use later by running the "Container Use: Install" command.');
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

                vscode.window.withProgress({ title: 'Installing Dagger...', location: vscode.ProgressLocation.Notification }, async (progress) => {
                    // Execute the installation command
                    const terminal = vscode.window.createTerminal('Dagger');
                    progress.report({ message: 'Running installation command...' });
                    terminal.sendText(installCommand);
                })
                    .then(async () => {
                        // Wait for the terminal to finish executing the command
                        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds for the command to complete
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
                            const version = await new DaggerCli().run(['version']);
                            vscode.window.showInformationMessage(`✅ Dagger (${version.stdout}) installed!`);
                        } else {
                            vscode.window.showWarningMessage('⚠️ Dagger was not found. Please check the terminal output for any errors and ensure your PATH is updated.');
                        }
                    }
                }, 8000); // Wait 8 seconds for brew (slower than curl)

                return;
            }

            vscode.window.showInformationMessage('Dagger is already installed.');
        })
    );
}