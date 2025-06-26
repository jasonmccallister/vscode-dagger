import * as vscode from 'vscode';

type ResetChoice = 'Yes' | 'No';

/**
 * Resets Dagger preferences including cloud token and notification settings
 * @param context The extension context
 * @param config The workspace configuration
 */
const resetPreferences = async (
    context: vscode.ExtensionContext, 
    config: vscode.WorkspaceConfiguration
): Promise<void> => {
    await Promise.all([
        context.secrets.delete('dagger.cloudToken'),
        config.update('cloudNotificationDismissed', false, vscode.ConfigurationTarget.Global)
    ]);
    
    vscode.window.showInformationMessage('Dagger preferences have been reset.');
};

export default function resetCommand(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand('dagger.resetPreferences', async () => {
        const config = vscode.workspace.getConfiguration('dagger');

        const response = await vscode.window.showWarningMessage(
            'Are you sure you want to reset your Dagger preferences?',
            { modal: true },
            'Yes',
            'No'
        ) as ResetChoice | undefined;

        if (response === 'Yes') {
            await resetPreferences(context, config);
        }
    });

    context.subscriptions.push(disposable);
}