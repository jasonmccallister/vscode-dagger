import * as vscode from 'vscode';

export default function resetCommand(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.resetPreferences', async () => {
            const config = vscode.workspace.getConfiguration('dagger');

            const response = await vscode.window.showWarningMessage(
                'Are you sure you want to reset your Dagger preferences?',
                { modal: true },
                'Yes',
                'No'
            );

            if (response === 'Yes') {
                await context.secrets.delete('dagger.cloudToken');
                await config.update('cloudNotificationDismissed', false, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('Dagger preferences have been reset.');
            }
        })
    );
}