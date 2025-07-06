import * as vscode from 'vscode';
import { DaggerSettings } from '../../settings';

type ResetChoice = 'Yes' | 'No';

const COMMAND = 'dagger.reset';

export const registerResetCommand = (
    context: vscode.ExtensionContext,
    settings: DaggerSettings
): void => {
    const disposable = vscode.commands.registerCommand(COMMAND, async () => {
        const response = await vscode.window.showWarningMessage(
            'Are you sure you want to reset your Dagger preferences?',
            { modal: true },
            'Yes',
            'No'
        ) as ResetChoice | undefined;

        if (response === 'Yes') {
            await resetPreferences(context, settings);
        }
    });

    context.subscriptions.push(disposable);
};

/**
 * Resets Dagger preferences including cloud token and notification settings
 * @param context The extension context
 * @param settings The dagger settings
 */
const resetPreferences = async (
    context: vscode.ExtensionContext,
    settings: DaggerSettings
): Promise<void> => {
    await Promise.all([
        context.secrets.delete('dagger.cloudToken'),
        settings.update('cloudNotificationDismissed', false, vscode.ConfigurationTarget.Global),
        settings.update('saveTaskPromptDismissed', false, vscode.ConfigurationTarget.Global)
    ]);

    vscode.window.showInformationMessage('Dagger preferences have been reset.');
};

