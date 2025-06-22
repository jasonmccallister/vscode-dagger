import * as vscode from 'vscode';
import DaggerCli from './cli';
import { exists } from './executable';
import Commands from './commands';

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

/**
 * Ensure Dagger CLI is installed before running a command
 * @returns true if Dagger is installed, false otherwise
 */
async function ensureInstalled(): Promise<boolean> {
	const isDaggerInstalled = await exists('dagger');

	if (!isDaggerInstalled) {
		const response = await vscode.window.showErrorMessage(
			'Dagger CLI is required for this command but is not installed.',
			'Install Now',
			'Cancel'
		);

		if (response === 'Install Now') {
			await vscode.commands.executeCommand('dagger.install');
			// After installation attempt, check again
			return await exists('dagger');
		}

		return false;
	}

	return true;
}

export async function activate(context: vscode.ExtensionContext) {
	Commands.register(context, "");

	const cli = new DaggerCli();

	context.subscriptions.push(
		vscode.commands.registerCommand('dagger.functions', async () => {
			if (!await ensureInstalled()) {
				return;
			}

			// check if this workspace is already a dagger project
			if (!await cli.isDaggerProject()) {
				const choice = await vscode.window.showErrorMessage(
					`This workspace is not a Dagger project. Please run the "Dagger: Init" command to initialize it.`,
					{ modal: true },
					'Run Init',
					'No'
				);

				if (choice === 'Run Init') {
					// Open a terminal and run the dagger init command
					const terminal = vscode.window.createTerminal('Dagger');
					terminal.sendText('dagger init');
					terminal.show();
				}

				return;
			}

			// Open a terminal and run the dagger functions command
			const terminal = vscode.window.createTerminal('Dagger');
			terminal.sendText('dagger functions');
			terminal.show();
		}),
	);

	// Check Dagger Cloud setup after confirming CLI is installed
	checkDaggerCloudSetup(context);
}

export function deactivate() { }