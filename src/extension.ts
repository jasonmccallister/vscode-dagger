import * as vscode from 'vscode';
import { registerTreeView } from './tree/provider';
import { registerInstallCommand } from './commands/install';
import { registerUpdateCommand } from './commands/update';
import { registerUninstallCommand } from './commands/uninstall';
import { registerVersionCommand } from './commands/version';
import { registerInitCommand } from './commands/init';
import { registerDevelopCommand } from './commands/develop';
import { registerCloudCommand } from './commands/cloud';
import { registerFunctionsCommand } from './commands/functions';
import { registerResetCommand } from './commands/reset';
import { registerShellCommand } from './commands/shell';
import { registerCallCommand } from './commands/call';
import { registerInstallModuleCommand } from './commands/install-module';
import { checkInstallation, InstallResult } from './utils/installation';
import * as os from 'os';

export async function activate(context: vscode.ExtensionContext) {
	try {
		// Check installation status before setting up commands and views
		const installResult = await checkInstallation(os.platform());

		if (!installResult.hasCorrectBinary) {
			// Show installation prompt and register install command only
			await handleMissingInstallation(context, installResult);
			return;
		}

		// Dagger is properly installed, proceed with full activation
		await activateExtension(context);
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to activate Dagger extension: ${error}`);
		// Still register commands as fallback
		registerInstallCommand(context);
	}
}

const activateExtension = async (context: vscode.ExtensionContext): Promise<void> => {
	// Register all commands when Dagger is installed
	registerInstallCommand(context);
	registerUpdateCommand(context);
	registerUninstallCommand(context);
	registerVersionCommand(context);
	registerInitCommand(context);
	registerDevelopCommand(context);
	registerCloudCommand(context);
	registerFunctionsCommand(context);
	registerResetCommand(context);
	registerShellCommand(context);
	registerCallCommand(context);
	registerInstallModuleCommand(context);

	// Register tree view for environments
	registerTreeView(context);
};

const handleMissingInstallation = async (context: vscode.ExtensionContext, installResult: InstallResult): Promise<void> => {
	// Register only the install command when not installed
	registerInstallCommand(context);

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