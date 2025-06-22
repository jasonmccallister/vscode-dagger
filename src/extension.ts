import * as vscode from 'vscode';
import DaggerCli from './cli';
import Commands from './commands';
import { registerDaggerTaskProvider } from './tasks/load';

/**
 * Check if Dagger Cloud token is available and show setup notification if needed
 */
async function checkDaggerCloudSetup(context: vscode.ExtensionContext): Promise<void> {
	const config = vscode.workspace.getConfiguration('dagger');
	const notificationDismissed = config.get<boolean>('cloudNotificationDismissed', false);

	// Check if token is available in secret storage or environment variable
	const secretToken = await context.secrets.get('dagger.cloudToken');
	const envToken = process.env.DAGGER_CLOUD_TOKEN;

	// If token is available (either in secret storage or environment) or notification was dismissed, don't show notification
	if (secretToken || envToken || notificationDismissed) {
		return;
	}

	// Show notification about Dagger Cloud setup
	const response = await vscode.window.showInformationMessage(
		'Setup Dagger Cloud to get better observability and collaboration features for your Dagger projects.',
		'Sign up',
		'Learn More',
		'Don\'t show again'
	);

	if (response === 'Sign up') {
		vscode.env.openExternal(vscode.Uri.parse('https://dagger.cloud'));
	} else if (response === 'Learn More') {
		vscode.env.openExternal(vscode.Uri.parse('https://docs.dagger.io/cloud'));
	} else if (response === 'Don\'t show again') {
		await config.update('cloudNotificationDismissed', true, vscode.ConfigurationTarget.Global);
	}
}

export async function activate(context: vscode.ExtensionContext) {
	Commands.register(context, "", new DaggerCli());
	registerDaggerTaskProvider(context);

	checkDaggerCloudSetup(context);
}