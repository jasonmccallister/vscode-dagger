import * as vscode from 'vscode';
import { registerTreeView } from './tree/provider';
import { checkInstallation, InstallResult } from './utils/installation';
import { promptCloud } from './actions/cloud';
import Cli from './dagger/dagger';
import * as os from 'os';
import { registerCallCommand } from './commands/call';
import { registerCloudCommand } from './commands/cloud';
import { registerDevelopCommand } from './commands/develop';
import { registerFunctionsCommand } from './commands/functions';
import { registerInitCommand } from './commands/init';
import { registerInstallCommand } from './commands/install';
import { registerInstallModuleCommand } from './commands/install-module';
import { registerResetCommand } from './commands/reset';
import { registerSaveTaskCommand } from './commands/save-task';
import { registerShellCommand } from './commands/shell';
import { registerUninstallCommand } from './commands/uninstall';
import { registerUpdateCommand } from './commands/update';
import { registerVersionCommand } from './commands/version';

export async function activate(context: vscode.ExtensionContext) {
	try {
		// Register install command first (always needed regardless of installation status)
		registerInstallCommand(context);

		// Check installation status before setting up other commands and views
		const installResult = await checkInstallation(os.platform());

		if (!installResult.hasCorrectBinary) {
			// Show installation prompt but don't register install command again
			await handleMissingInstallation(context, installResult);
			return;
		}

		// Dagger is properly installed, proceed with full activation
		await activateExtension(context);
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to activate Dagger extension: ${error}`);
		// Install command already registered above
	}
}

const activateExtension = async (context: vscode.ExtensionContext): Promise<void> => {
	// Create CLI instance and get workspace path
	const cli = new Cli();
	const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

	// Set workspace path for CLI if available
	if (workspacePath) {
		cli.setWorkspacePath(workspacePath);
	}

	// (install command already registered in activate function)
	registerUpdateCommand(context, cli);
	registerUninstallCommand(context, cli);
	registerVersionCommand(context, cli);
	registerInitCommand(context, cli);
	registerDevelopCommand(context, cli, workspacePath);
	registerCloudCommand(context, cli);
	registerFunctionsCommand(context);
	registerResetCommand(context);
	registerShellCommand(context, workspacePath);
	registerCallCommand(context, cli, workspacePath);
	registerInstallModuleCommand(context, cli);
	registerSaveTaskCommand(context, cli, workspacePath);

	// Register tree view for environments with CLI and workspace path
	registerTreeView(context, { cli, workspacePath, registerTreeCommands: true });

	// Show cloud setup notification if appropriate
	await promptCloud(context, cli);
};

const handleMissingInstallation = async (context: vscode.ExtensionContext, installResult: InstallResult): Promise<void> => {
	// Install command already registered in activate function

	// Still register tree view to show installation status
	const cli = new Cli();
	const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
	registerTreeView(context, { cli, workspacePath, registerTreeCommands: false });

	// Determine available installation methods for the prompt
	const installMethods: string[] = [];
	if (installResult.hasHomebrew && (installResult.platform === 'darwin' || installResult.platform === 'linux')) {
		installMethods.push('Homebrew (recommended)');
	}
	installMethods.push('curl script');

	const methodText = installMethods.length > 1
		? `Available installation methods: ${installMethods.join(', ')}`
		: `Installation method: ${installMethods[0]}`;

	// Show installation prompt
	const action = await vscode.window.showWarningMessage(
		`Dagger is not installed or not properly configured. ${methodText}`,
		'Install Now',
		'Install Later',
		'Learn More'
	);

	switch (action) {
		case 'Install Now':
			// Trigger the install command
			await vscode.commands.executeCommand('dagger.install');
			break;
		case 'Learn More':
			vscode.env.openExternal(vscode.Uri.parse('https://github.com/dagger/dagger'));
			break;
		// 'Install Later' or no selection just continues without action
	}
};