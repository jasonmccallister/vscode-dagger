import * as vscode from 'vscode';
import Cli from '../dagger/dagger';
import { exists } from '../executable';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const INSTALL_OPTIONS = {
    HOMEBREW: 'Use Homebrew (recommended)',
    CURL: 'Use curl script',
    INSTALL_CURL: 'Install (curl)',
    INSTALL: 'Install',
    CANCEL: 'Cancel'
} as const;

const INSTALL_COMMANDS = {
    BREW: 'brew install dagger/tap/dagger',
    CURL: 'curl -fsSL https://dl.dagger.io/dagger/install.sh | BIN_DIR=$HOME/.local/bin sh'
} as const;

type InstallMethod = 'brew' | 'curl' | '';
type InstallOption = typeof INSTALL_OPTIONS[keyof typeof INSTALL_OPTIONS];

interface InstallConfig {
    readonly installMethod: InstallMethod;
    readonly availableOptions: readonly string[];
}

/**
 * Determines available install options based on platform and brew availability
 * @param defaultMethod The user's preferred install method
 * @returns Configuration for install options
 */
const getInstallConfig = async (defaultMethod: InstallMethod): Promise<InstallConfig> => {
    const isMacOrLinux = process.platform === 'darwin' || process.platform === 'linux';
    
    if (!isMacOrLinux) {
        return {
            installMethod: 'curl',
            availableOptions: [INSTALL_OPTIONS.INSTALL_CURL, INSTALL_OPTIONS.CANCEL]
        };
    }

    const hasHomebrew = await exists('brew');
    
    if (!hasHomebrew) {
        return {
            installMethod: 'curl',
            availableOptions: defaultMethod === '' || defaultMethod === 'curl' 
                ? [INSTALL_OPTIONS.INSTALL_CURL, INSTALL_OPTIONS.CANCEL]
                : [INSTALL_OPTIONS.INSTALL_CURL, INSTALL_OPTIONS.CANCEL]
        };
    }

    // Has homebrew
    if (defaultMethod === '') {
        return {
            installMethod: '',
            availableOptions: [INSTALL_OPTIONS.HOMEBREW, INSTALL_OPTIONS.CURL]
        };
    }

    const preferredOption = defaultMethod === 'brew' ? INSTALL_OPTIONS.HOMEBREW : INSTALL_OPTIONS.CURL;
    const alternateOption = defaultMethod === 'brew' ? INSTALL_OPTIONS.CURL : INSTALL_OPTIONS.HOMEBREW;
    
    return {
        installMethod: defaultMethod,
        availableOptions: [preferredOption, alternateOption]
    };
};

/**
 * Determines the install method from user's choice
 * @param response The user's selected option
 * @param defaultMethod The default install method
 * @returns The selected install method
 */
const getInstallMethodFromResponse = (response: string, defaultMethod: InstallMethod): InstallMethod => {
    switch (response) {
        case INSTALL_OPTIONS.HOMEBREW:
            return 'brew';
        case INSTALL_OPTIONS.CURL:
        case INSTALL_OPTIONS.INSTALL_CURL:
            return 'curl';
        case INSTALL_OPTIONS.INSTALL:
            return defaultMethod === '' ? 'curl' : defaultMethod;
        default:
            return 'curl';
    }
};

/**
 * Executes the install command with progress reporting
 * @param installMethod The install method to use
 * @returns Promise that resolves when installation completes
 */
const executeInstallCommand = async (installMethod: InstallMethod): Promise<void> => {
    const command = installMethod === 'brew' ? INSTALL_COMMANDS.BREW : INSTALL_COMMANDS.CURL;
    
    return vscode.window.withProgress({ 
        title: 'Dagger', 
        location: vscode.ProgressLocation.Notification 
    }, async (progress) => {
        progress.report({ message: 'Running installation command...' });

        try {
            await execAsync(command);
            vscode.window.showInformationMessage(`Dagger installation completed using ${installMethod}.`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Dagger installation failed: ${errorMessage}`);
        }
    });
};

/**
 * Verifies the Dagger installation
 * @param cli The Dagger CLI instance
 */
const verifyInstallation = async (cli: Cli): Promise<void> => {
    if (await exists('dagger')) {
        try {
            const { stdout } = await cli.run(['version']);
            const versionMatch = stdout.match(/v(\d+\.\d+\.\d+)/);
            const versionNumber = versionMatch?.[1] ?? 'unknown';
            vscode.window.showInformationMessage(`✅ Dagger v${versionNumber} installed!`);
        } catch {
            vscode.window.showInformationMessage('✅ Dagger installed, but version could not be determined.');
        }
    } else {
        vscode.window.showWarningMessage('⚠️ Dagger was not found. Please check the output for any errors and ensure your PATH is updated.');
    }
};

/**
 * Prompts user to verify installation after a delay
 * @param cli The Dagger CLI instance
 */
const promptForVerification = (cli: Cli): void => {
    setTimeout(async () => {
        const verifyResponse = await vscode.window.showInformationMessage(
            'Installation command has been executed. Would you like to verify the installation?',
            'Verify',
            'Later'
        );

        if (verifyResponse === 'Verify') {
            await verifyInstallation(cli);
        }
    }, 8000); // Wait 8 seconds for installation to complete
};

export default function installCommand(context: vscode.ExtensionContext, cli: Cli): void {
    // Register the install command
    const disposable = vscode.commands.registerCommand('dagger.install', async () => {
        if (await cli.isInstalled()) {
            vscode.window.showInformationMessage('Dagger is already installed.');
            return;
        }

        // Get current install method preference from settings
        const config = vscode.workspace.getConfiguration('dagger');
        const defaultInstallMethod: InstallMethod = config.get('installMethod', '');

        // Get install configuration based on platform and availability
        const { availableOptions } = await getInstallConfig(defaultInstallMethod);

        const installResponse = await vscode.window.showInformationMessage(
            'Dagger is not installed. Would you like to install it now?',
            { modal: true },
            ...availableOptions
        ) as InstallOption | undefined;

        if (installResponse === INSTALL_OPTIONS.CANCEL || !installResponse) {
            vscode.window.showInformationMessage('Installation cancelled. You can install Dagger later by running the "Dagger: Install CLI" command.');
            return;
        }

        // Determine install method based on response
        const installMethod = getInstallMethodFromResponse(installResponse, defaultInstallMethod);

        // Update the setting with the user's choice (only if they made a specific choice and no preference was set)
        if (defaultInstallMethod === '' && (installResponse === INSTALL_OPTIONS.HOMEBREW || installResponse === INSTALL_OPTIONS.CURL)) {
            await config.update('installMethod', installMethod, vscode.ConfigurationTarget.Global);
        }

        // Execute installation
        await executeInstallCommand(installMethod);

        // Show option to verify installation after a delay
        promptForVerification(cli);
    });

    context.subscriptions.push(disposable);
}