import * as vscode from 'vscode';
import { checkInstallation, InstallResult } from '../utils/installation';
import * as os from 'os';

export const registerInstallCommand = (context: vscode.ExtensionContext): void => {
    const installCommand = vscode.commands.registerCommand('dagger.install', async () => {
        try {
            const result = await checkInstallation(os.platform());

            if (result.hasCorrectBinary) {
                vscode.window.showInformationMessage('Dagger is already installed and ready to use!');
                return;
            }

            await handleInstallation(result);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to check installation: ${error}`);
        }
    });

    context.subscriptions.push(installCommand);
};

const handleInstallation = async (result: InstallResult): Promise<void> => {
    const config = vscode.workspace.getConfiguration('dagger');

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

    // Save the selected method to configuration
    await config.update('installMethod', selectedMethod.value, vscode.ConfigurationTarget.Global);

    // Show instructions based on selected method
    await showInstallationInstructions(selectedMethod.value);
};

const showInstallationInstructions = async (method: string): Promise<void> => {
    let instructions: string;
    let terminalCommand: string;

    switch (method) {
        case 'brew':
            instructions = 'Dagger will be installed using Homebrew.';
            terminalCommand = 'brew install dagger/tap/dagger';
            break;
        case 'curl':
            instructions = 'Dagger will be installed using the curl script.';
            terminalCommand = 'curl -fsSL https://raw.githubusercontent.com/dagger/dagger/main/install.sh | bash';
            break;
        default:
            vscode.window.showErrorMessage('Unknown installation method selected.');
            return;
    }

    const action = await vscode.window.showInformationMessage(
        instructions,
        'Copy Command',
        'Open Terminal',
        'Cancel'
    );

    switch (action) {
        case 'Copy Command':
            await vscode.env.clipboard.writeText(terminalCommand);
            vscode.window.showInformationMessage('Installation command copied to clipboard!');
            break;
        case 'Open Terminal':
            const terminal = vscode.window.createTerminal('Dagger Installation');
            terminal.show();
            terminal.sendText(terminalCommand);
            break;
    }
};