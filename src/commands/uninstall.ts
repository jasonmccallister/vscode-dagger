import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import Cli from '../dagger/dagger';

const execAsync = promisify(exec);

const UNINSTALL_COMMANDS = {
    BREW: 'brew uninstall dagger/tap/dagger',
    CURL: 'type dagger >/dev/null 2>&1 && rm -rf $(dirname $(which dagger)) || true'
} as const;

type UninstallChoice = 'Uninstall' | 'Cancel';
type InstallMethod = 'brew' | 'curl';

/**
 * Executes the uninstall command based on the install method
 * @param installMethod The method used to install Dagger
 */
const executeUninstallCommand = async (installMethod: InstallMethod): Promise<void> => {
    return vscode.window.withProgress({ 
        title: 'Dagger', 
        location: vscode.ProgressLocation.Notification 
    }, async (progress) => {
        progress.report({ message: 'Uninstalling...' });

        const command = installMethod === 'brew' ? UNINSTALL_COMMANDS.BREW : UNINSTALL_COMMANDS.CURL;
        
        try {
            await execAsync(command);
            vscode.window.showInformationMessage('Dagger has been uninstalled successfully.');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Dagger uninstallation failed: ${errorMessage}`);
        }
    });
};

export const registerUninstallCommand = (
    context: vscode.ExtensionContext,
    cli: Cli
): void => {
    const disposable = vscode.commands.registerCommand('dagger.uninstall', async () => {
        if (!await cli.isInstalled()) {
            vscode.window.showInformationMessage('Dagger is not installed. No action taken.');
            return;
        }

        const response = await vscode.window.showInformationMessage(
            'Are you sure you want to uninstall Dagger?',
            { modal: true },
            'Uninstall',
            'Cancel'
        ) as UninstallChoice | undefined;

        if (response === 'Uninstall') {
            try {
                const config = vscode.workspace.getConfiguration('dagger');
                const installedMethod: InstallMethod = config.get('installMethod', 'curl');
                
                await executeUninstallCommand(installedMethod);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to uninstall Dagger: ${errorMessage}`);
            }
        }
    });

    context.subscriptions.push(disposable);
};