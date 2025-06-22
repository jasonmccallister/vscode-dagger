import * as vscode from 'vscode';

export default function resetCommand(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.resetPreferences', async () => {
            const config = vscode.workspace.getConfiguration('dagger');
            const currentToken = config.get<string>('cloudToken', '');
            const envToken = process.env.DAGGER_CLOUD_TOKEN;

            if (!currentToken && !envToken) {
                vscode.window.showInformationMessage('No Dagger Cloud token is set. No action taken.');
                return;
            }

            const response = await vscode.window.showWarningMessage(
                'Are you sure you want to reset your Dagger preferences?',
                { modal: true },
                'Yes',
                'No'
            );

            if (response === 'Yes') {
                await config.update('cloudToken', '', vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('Dagger preferences have been reset.');
            }
        })
    );
}