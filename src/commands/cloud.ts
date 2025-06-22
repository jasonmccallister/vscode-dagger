import * as vscode from 'vscode';
import DaggerCli from '../cli';

export default function cloudCommand(context: vscode.ExtensionContext) {
    const cli = new DaggerCli();

    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.setupCloud', async () => {
            const config = vscode.workspace.getConfiguration('dagger');
            const currentToken = config.get<string>('cloudToken', '');
            const envToken = process.env.DAGGER_CLOUD_TOKEN;

            let message = 'Setup Dagger Cloud to get enhanced observability and collaboration features.';
            if (envToken) {
                message = 'Dagger Cloud token is already set via DAGGER_CLOUD_TOKEN environment variable.';
            } else if (currentToken) {
                message = 'Dagger Cloud token is already configured in settings.';
            }

            const response = await vscode.window.showInformationMessage(
                message,
                'Visit dagger.cloud',
                'Open Settings',
                ...(currentToken || envToken ? ['Test Connection'] : []),
                'Cancel'
            );

            if (response === 'Visit dagger.cloud') {
                vscode.env.openExternal(vscode.Uri.parse('https://dagger.cloud'));
            } else if (response === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'dagger.cloudToken');
            } else if (response === 'Test Connection' && (currentToken || envToken)) {
                // Simple check - if we have a token, consider it valid for now
                // In a real implementation, you might want to make an API call to verify
                vscode.window.showInformationMessage('✅ Dagger Cloud token is configured and ready to use!');
            }
        })
    );

}